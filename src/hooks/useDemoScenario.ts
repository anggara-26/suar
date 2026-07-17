import { useCallback, useEffect, useRef, useState } from 'react';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { isValidFix } from '@/src/utils/geo';
import { BeaconType } from '@/src/types/beacon';
import { MAX_HOPS_MESH } from '@/src/protocol/constants';
import {
  APPROACHING_PEER_ID,
  RELAYED_BEACON_IDS,
  FALLBACK_ORIGIN,
  TIMING,
  APPROACH_STEP_COUNT,
  RELAYED_HOPS_REMAINING,
  computeApproachStep,
  computeRelayedBeaconStep,
  computeRelayedBeaconPosition,
  relayedStepCount,
  type SimulatedPosition,
} from '@/src/services/demo/demoScenario';

export type DemoPhase = 'idle' | 'countdown' | 'running';

interface DemoScenarioCallbacks {
  /** Opens/closes the real AssemblyToggleSheet — RadarScreen still owns that boolean locally. */
  openSettings: () => void;
  closeSettings: () => void;
}

/** A fabricated fix still needs a plausible accuracy — tight, since these are meant to read as good GPS fixes. */
const SIMULATED_ACCURACY_METERS = 8;

/**
 * Drives the scripted demo end to end (see plan: hidden 5-tap trigger). Every
 * mutation goes through the app's real actions (`upsertBeacon`,
 * `setIsAssemblyPoint`) — a simulated beacon is indistinguishable from a real
 * one to the map, the list, haptics, or voice guidance, so none of them need
 * to know a demo is running.
 */
export function useDemoScenario({ openSettings, closeSettings }: DemoScenarioCallbacks) {
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [countdownValue, setCountdownValue] = useState<number>(TIMING.countdownSeconds);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const preRunAssemblyPointRef = useRef(false);
  const sequenceRef = useRef(0);

  const schedule = useCallback((fn: () => void, delayMs: number) => {
    timeoutsRef.current.push(setTimeout(fn, delayMs));
  }, []);

  const clearAllTimers = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
  }, []);

  const nextSequence = useCallback(() => {
    sequenceRef.current += 1;
    return sequenceRef.current;
  }, []);

  const upsertSimulatedBeacon = useCallback(
    (deviceId: string, position: SimulatedPosition, isRelay: boolean) => {
      useBeaconStore.getState().upsertBeacon({
        deviceId,
        beaconType: BeaconType.Person,
        isRelay,
        hopsRemaining: isRelay ? RELAYED_HOPS_REMAINING : MAX_HOPS_MESH,
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: Date.now(),
        sequence: nextSequence(),
        accuracyMeters: SIMULATED_ACCURACY_METERS,
        rawRssi: position.rawRssi,
      });
    },
    [nextSequence],
  );

  const cancel = useCallback(() => {
    clearAllTimers();
    const simulatedIds = [APPROACHING_PEER_ID, ...RELAYED_BEACON_IDS];
    useBeaconStore.setState((state) => {
      const next = { ...state.discoveredBeacons };
      for (const id of simulatedIds) delete next[id];
      return { discoveredBeacons: next };
    });
    useSettingsStore.getState().setIsAssemblyPoint(preRunAssemblyPointRef.current);
    setPhase('idle');
    setCountdownValue(TIMING.countdownSeconds);
  }, [clearAllTimers]);

  const runKeepAlive = useCallback(
    (origin: { lat: number; lon: number }) => {
      const interval = setInterval(() => {
        upsertSimulatedBeacon(
          APPROACHING_PEER_ID,
          computeApproachStep(APPROACH_STEP_COUNT - 1, origin.lat, origin.lon),
          false,
        );
        RELAYED_BEACON_IDS.forEach((id, index) => {
          upsertSimulatedBeacon(id, computeRelayedBeaconPosition(index, origin.lat, origin.lon), true);
        });
      }, TIMING.keepAliveIntervalMs);
      intervalsRef.current.push(interval);
    },
    [upsertSimulatedBeacon],
  );

  const runRelaySequence = useCallback(
    (origin: { lat: number; lon: number }) => {
      // Each relayed beacon walks in on its own staggered start (see
      // runAssemblyPointSequence) and its own step count — the whole group
      // needs to feel like it's genuinely walking in *with* the peer, not
      // popping into place already-arrived once the peer has settled.
      RELAYED_BEACON_IDS.forEach((id, index) => {
        const walkStartDelay = TIMING.relayStartDelayMs + index * TIMING.relayWalkStaggerMs;
        const stepCount = relayedStepCount(index);
        for (let step = 0; step < stepCount; step += 1) {
          schedule(() => {
            upsertSimulatedBeacon(id, computeRelayedBeaconStep(index, step, origin.lat, origin.lon), true);
          }, walkStartDelay + step * TIMING.relayWalkStepMs);
        }
      });
    },
    [schedule, upsertSimulatedBeacon],
  );

  const runApproachSequence = useCallback(
    (origin: { lat: number; lon: number }) => {
      for (let step = 0; step < APPROACH_STEP_COUNT; step += 1) {
        schedule(() => {
          upsertSimulatedBeacon(APPROACHING_PEER_ID, computeApproachStep(step, origin.lat, origin.lon), false);
        }, step * TIMING.approachStepMs);
      }
      // The approach is the longer-running of the two sequences (12s vs. the
      // slowest relayed beacon settling in at ~10.8s), so anchoring keep-alive
      // off its completion safely covers both — nothing left scripted to fire
      // after this.
      schedule(() => runKeepAlive(origin), APPROACH_STEP_COUNT * TIMING.approachStepMs + 500);
    },
    [schedule, upsertSimulatedBeacon, runKeepAlive],
  );

  const runAssemblyPointSequence = useCallback(() => {
    openSettings();
    schedule(() => useSettingsStore.getState().setIsAssemblyPoint(true), TIMING.settingsOpenDwellMs);
    schedule(closeSettings, TIMING.settingsOpenDwellMs + TIMING.toggleDwellMs);

    schedule(() => {
      const ownLocation = useBeaconStore.getState().ownLocation;
      // A device with no fix (or still on the (0,0) placeholder — see
      // beaconCodec's wire format) falls back to a fixed origin so the demo
      // looks right on any device, not just ones with a live GPS fix.
      const origin =
        ownLocation && isValidFix(ownLocation.latitude, ownLocation.longitude)
          ? { lat: ownLocation.latitude, lon: ownLocation.longitude }
          : FALLBACK_ORIGIN;
      // Both run off the same start time — the relayed group cascades in
      // while the peer is still walking, not after they've already arrived.
      runApproachSequence(origin);
      runRelaySequence(origin);
    }, TIMING.settingsOpenDwellMs + TIMING.toggleDwellMs + TIMING.closeDwellMs);
  }, [openSettings, closeSettings, schedule, runApproachSequence, runRelaySequence]);

  const start = useCallback(() => {
    if (phase !== 'idle') return;
    preRunAssemblyPointRef.current = useSettingsStore.getState().isAssemblyPoint;
    setPhase('countdown');
    setCountdownValue(TIMING.countdownSeconds);

    for (let tick = 1; tick < TIMING.countdownSeconds; tick += 1) {
      schedule(() => setCountdownValue(TIMING.countdownSeconds - tick), tick * 1000);
    }
    schedule(() => {
      setPhase('running');
      runAssemblyPointSequence();
    }, TIMING.countdownSeconds * 1000);
  }, [phase, schedule, runAssemblyPointSequence]);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  return { phase, countdownValue, start, cancel };
}
