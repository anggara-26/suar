import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadOrCreateDeviceId } from '@/src/protocol/deviceId';
import { requestBlePermissions } from '@/src/services/permissions/PermissionsService';
import { ensureBluetoothEnabled } from '@/src/services/ble/BleAdapterService';
import { stopBroadcast } from '@/src/services/ble/BroadcastService';
import { startScan, stopScan, type ScanEvent } from '@/src/services/ble/ScanService';
import * as RelayService from '@/src/services/ble/RelayService';
import {
  startWatchingLocation,
  stopWatchingLocation,
  type LocationSample,
} from '@/src/services/location/LocationService';
import { startWatchingHeading, stopWatchingHeading } from '@/src/services/compass/CompassService';
import { playBucketPattern, stopHaptics } from '@/src/services/haptics/HapticService';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { BeaconType } from '@/src/types/beacon';
import { ACCURACY_UNKNOWN_METERS } from '@/src/protocol/beaconCodec';
import { selectNearestBeacon } from '@/src/utils/beaconSelection';
import {
  BROADCAST_INTERVAL_MS,
  BEACON_STALE_AFTER_MS,
  MAX_HOPS_MESH,
  SEEN_MESSAGE_TTL_MS,
  SEEN_MESSAGE_SWEEP_INTERVAL_MS,
} from '@/src/protocol/constants';

export type BleLifecycleStatus =
  | 'idle'
  | 'requesting-permissions'
  | 'permission-denied'
  | 'starting'
  | 'running'
  | 'error';

/**
 * Orchestrates the full BLE lifecycle as one hook: F1 (broadcast presence+GPS),
 * F2 (receive+list beacons), F3 (proximity haptic), and F8/F9 (single-hop /
 * multi-hop relay, via RelayService) — request permissions, power on
 * Bluetooth, then start watching location, scanning, and broadcasting together.
 */
export function useBleLifecycle() {
  const [status, setStatus] = useState<BleLifecycleStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestLocation = useRef<LocationSample | null>(null);
  // AppState handlers need the current status without re-registering listeners.
  const statusRef = useRef<BleLifecycleStatus>('idle');
  statusRef.current = status;

  useEffect(() => {
    let cancelled = false;

    function handleObservation({ observation, rssi }: ScanEvent) {
      const ownDeviceId = useBeaconStore.getState().ownIdentity.deviceId;
      // Our own frame can come back at us via another device's relay —
      // never show ourselves on our own radar.
      if (observation.deviceId === ownDeviceId) return;

      useBeaconStore.getState().upsertBeacon({
        deviceId: observation.deviceId,
        beaconType: observation.beaconType,
        isRelay: observation.isRelay,
        hopsRemaining: observation.hopsRemaining,
        latitude: observation.latitude,
        longitude: observation.longitude,
        timestamp: observation.timestamp,
        sequence: observation.sequence,
        accuracyMeters: observation.accuracyMeters,
        rawRssi: rssi,
      });

      RelayService.registerObservedBeacon(observation, ownDeviceId);
    }

    async function start() {
      // Stable identity must be in place before the first broadcast: a fresh
      // random ID every launch makes this phone reappear as a "new" beacon on
      // every radar that saw the old one (duplicate dots for one device).
      const deviceId = await loadOrCreateDeviceId();
      if (cancelled) return;
      useBeaconStore.getState().setOwnDeviceId(deviceId);

      setStatus('requesting-permissions');
      const granted = await requestBlePermissions();
      if (cancelled) return;
      if (!granted) {
        setStatus('permission-denied');
        return;
      }

      try {
        setStatus('starting');
        await ensureBluetoothEnabled();
        if (cancelled) return;

        startWatchingLocation(
          (sample) => {
            latestLocation.current = sample;
            useBeaconStore.getState().setOwnLocation(sample);
          },
          (message) => {
            // Non-fatal: broadcasting carries the (0,0) placeholder until a fix
            // arrives (see refreshOwnFrame), so this only degrades placement.
            console.warn('[useBleLifecycle] location watch error:', message);
          },
        );

        // Heading feeds the radar's heading-up rotation. On devices without a
        // magnetometer the callback simply never fires and the radar stays
        // north-up — no error path needed.
        startWatchingHeading((sample) => {
          useBeaconStore.getState().setOwnHeading(sample.heading);
        });

        await startScan(handleObservation);

        setStatus('running');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setStatus('error');
        }
      }
    }

    // Radio must go silent the moment the app leaves the foreground. Android
    // pauses JS timers on background but leaves the last BLE advertisement
    // registered — a frozen frame that keeps transmitting stale state (old
    // assembly flag, old GPS) indefinitely, which other radars see fighting
    // with our next session's live frames ("blinking" between states).
    function goSilent() {
      RelayService.stopRotation();
      stopBroadcast();
      stopScan();
      stopHaptics();
    }

    async function resume() {
      try {
        await startScan(handleObservation);
        RelayService.startRotation();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus('error');
      }
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      // Only manage the radio once the pipeline actually reached 'running' —
      // an early 'active' event must not start scanning before permissions.
      if (cancelled || statusRef.current !== 'running') return;
      if (nextState === 'active') {
        resume();
      } else {
        goSilent();
      }
    });

    start();

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      goSilent();
      stopWatchingLocation();
      stopWatchingHeading();
    };
  }, []);

  // Content refresh — recomputes our own frame (fresh GPS + new sequence) on
  // an interval and hands it to RelayService, which owns actually pushing
  // bytes over the radio (Android only has one advertising slot, so it also
  // interleaves any beacons we're relaying — see RelayService for why this
  // can't just be a plain updateBroadcast() call here).
  useEffect(() => {
    if (status !== 'running') return;

    function refreshOwnFrame() {
      // No early return on a missing fix: presence broadcasting must not wait
      // on GPS (pure GPS-only, no network assist — a fix can take a while or
      // never come indoors). (0, 0) is the documented "no real fix yet"
      // placeholder mapPlacement.ts already expects (see its `isValidFix`),
      // which keeps the receiving end off the map and in the RSSI-only strip
      // instead of implying a direction. Real coordinates take over
      // automatically once `latestLocation.current` is populated.
      const location = latestLocation.current;

      const sequence = useBeaconStore.getState().incrementSequence();
      const deviceId = useBeaconStore.getState().ownIdentity.deviceId;
      const isAssemblyPoint = useSettingsStore.getState().isAssemblyPoint;

      RelayService.setOwnFrame({
        deviceId,
        beaconType: isAssemblyPoint ? BeaconType.Assembly : BeaconType.Person,
        isRelay: false,
        // Multi-hop mesh (F9): every guard that makes this safe (unique message
        // ID, hop counter, seen-set) is already in protocol/relay.ts and
        // RelayService — a relayed frame is itself eligible for further
        // relay, so raising this from 1 to MAX_HOPS_MESH is what turns F8's
        // single-hop relay into F9's mesh, with no other code changes needed.
        hopsRemaining: MAX_HOPS_MESH,
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        // Same placeholder logic as the coordinates above: with no fix there's
        // no accuracy to report either, and "unknown" is the honest answer —
        // claiming 0m would tell receivers this phantom position is perfect.
        accuracyMeters: location?.accuracy ?? ACCURACY_UNKNOWN_METERS,
        timestamp: Date.now(),
        sequence,
      });
    }

    refreshOwnFrame();
    RelayService.startRotation();
    const interval = setInterval(refreshOwnFrame, BROADCAST_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status]);

  // Haptic feedback follows the focused beacon (or the nearest one by default),
  // gated on the vibration setting — both stores retrigger it so toggling the
  // setting takes effect immediately, not on the next beacon update.
  useEffect(() => {
    function applyHapticTarget() {
      if (!useSettingsStore.getState().hapticsEnabled) {
        stopHaptics();
        return;
      }

      const state = useBeaconStore.getState();
      const target = state.focusedBeaconId
        ? state.discoveredBeacons[state.focusedBeaconId]
        : selectNearestBeacon(state.discoveredBeacons);

      if (target) {
        playBucketPattern(target.bucket);
      } else {
        stopHaptics();
      }
    }

    const unsubscribeBeacons = useBeaconStore.subscribe(applyHapticTarget);
    const unsubscribeSettings = useSettingsStore.subscribe(applyHapticTarget);
    return () => {
      unsubscribeBeacons();
      unsubscribeSettings();
    };
  }, []);

  // Drop beacons we haven't heard from in a while.
  useEffect(() => {
    const interval = setInterval(() => {
      useBeaconStore.getState().pruneStaleBeacons(BEACON_STALE_AFTER_MS);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Evict old relay-dedup entries so the seen-set doesn't grow unbounded over
  // a multi-hour demo (F9 mesh guard — see protocol/relay.ts).
  useEffect(() => {
    const interval = setInterval(() => {
      useBeaconStore.getState().pruneSeenMessages(SEEN_MESSAGE_TTL_MS);
    }, SEEN_MESSAGE_SWEEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { status, errorMessage };
}
