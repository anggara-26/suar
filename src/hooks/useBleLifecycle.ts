import { useEffect, useRef, useState } from 'react';
import { requestBlePermissions } from '@/src/services/permissions/PermissionsService';
import { ensureBluetoothEnabled } from '@/src/services/ble/BleAdapterService';
import { stopBroadcast } from '@/src/services/ble/BroadcastService';
import { startScan, stopScan } from '@/src/services/ble/ScanService';
import * as RelayService from '@/src/services/ble/RelayService';
import {
  startWatchingLocation,
  stopWatchingLocation,
  type LocationSample,
} from '@/src/services/location/LocationService';
import { playBucketPattern, stopHaptics } from '@/src/services/haptics/HapticService';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { BeaconType } from '@/src/types/beacon';
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

  useEffect(() => {
    let cancelled = false;

    async function start() {
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

        startWatchingLocation((sample) => {
          latestLocation.current = sample;
          useBeaconStore.getState().setOwnLocation(sample);
        });

        startScan(({ observation, rssi }) => {
          useBeaconStore.getState().upsertBeacon({
            deviceId: observation.deviceId,
            beaconType: observation.beaconType,
            isRelay: observation.isRelay,
            hopsRemaining: observation.hopsRemaining,
            latitude: observation.latitude,
            longitude: observation.longitude,
            timestamp: observation.timestamp,
            sequence: observation.sequence,
            rawRssi: rssi,
          });

          const ownDeviceId = useBeaconStore.getState().ownIdentity.deviceId;
          RelayService.registerObservedBeacon(observation, ownDeviceId);
        });

        setStatus('running');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setStatus('error');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stopScan();
      stopBroadcast();
      stopWatchingLocation();
      stopHaptics();
      RelayService.stopRotation();
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
      const location = latestLocation.current;
      if (!location) return;

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
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: Date.now(),
        sequence,
      });
    }

    refreshOwnFrame();
    RelayService.startRotation();
    const interval = setInterval(refreshOwnFrame, BROADCAST_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status]);

  // Haptic feedback follows the focused beacon (or the nearest one by default).
  useEffect(() => {
    const unsubscribe = useBeaconStore.subscribe((state) => {
      const target = state.focusedBeaconId
        ? state.discoveredBeacons[state.focusedBeaconId]
        : selectNearestBeacon(state.discoveredBeacons);

      if (target) {
        playBucketPattern(target.bucket);
      } else {
        stopHaptics();
      }
    });
    return unsubscribe;
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
