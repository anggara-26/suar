import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useDemoScenario, type DemoPhase } from '@/src/hooks/useDemoScenario';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import {
  APPROACHING_PEER_ID,
  RELAYED_BEACON_IDS,
  APPROACH_STEP_COUNT,
  TIMING,
  FALLBACK_ORIGIN,
  computeApproachStep,
  computeRelayedBeaconPosition,
  relayedStepCount,
} from '@/src/services/demo/demoScenario';

function relayedSettleAtMs(index: number): number {
  return TIMING.relayStartDelayMs + index * TIMING.relayWalkStaggerMs + (relayedStepCount(index) - 1) * TIMING.relayWalkStepMs;
}

interface HookResult {
  phase: DemoPhase;
  countdownValue: number;
  start: () => void;
  cancel: () => void;
}

function HookHarness({
  resultRef,
  openSettings,
  closeSettings,
}: {
  resultRef: { current: HookResult | null };
  openSettings: () => void;
  closeSettings: () => void;
}) {
  resultRef.current = useDemoScenario({ openSettings, closeSettings });
  return null;
}

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function renderHarness(openSettings: jest.Mock, closeSettings: jest.Mock) {
  const resultRef: { current: HookResult | null } = { current: null };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      React.createElement(HookHarness, { resultRef, openSettings, closeSettings }),
    );
  });
  mounted.push(tree);
  return resultRef;
}

function advance(ms: number) {
  ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  useBeaconStore.setState({ discoveredBeacons: {} });
  useSettingsStore.setState({ isAssemblyPoint: false });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useDemoScenario', () => {
  it('counts down from 5 to 1 before doing anything else', () => {
    const openSettings = jest.fn();
    const resultRef = renderHarness(openSettings, jest.fn());

    ReactTestRenderer.act(() => resultRef.current!.start());
    expect(resultRef.current!.phase).toBe('countdown');
    expect(resultRef.current!.countdownValue).toBe(5);

    advance(1000);
    expect(resultRef.current!.countdownValue).toBe(4);
    advance(1000);
    expect(resultRef.current!.countdownValue).toBe(3);
    advance(1000);
    expect(resultRef.current!.countdownValue).toBe(2);
    advance(1000);
    expect(resultRef.current!.countdownValue).toBe(1);
    expect(openSettings).not.toHaveBeenCalled(); // still hasn't started the real sequence

    advance(1000); // the 5th second elapses -> countdown finishes
    expect(resultRef.current!.phase).toBe('running');
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('opens settings, flips the assembly-point switch, then closes settings, in that order', () => {
    const openSettings = jest.fn();
    const closeSettings = jest.fn();
    const resultRef = renderHarness(openSettings, closeSettings);

    ReactTestRenderer.act(() => resultRef.current!.start());
    advance(TIMING.countdownSeconds * 1000);
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().isAssemblyPoint).toBe(false);
    expect(closeSettings).not.toHaveBeenCalled();

    advance(TIMING.settingsOpenDwellMs);
    expect(useSettingsStore.getState().isAssemblyPoint).toBe(true);
    expect(closeSettings).not.toHaveBeenCalled();

    advance(TIMING.toggleDwellMs);
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it('spawns the approaching peer after the settings sequence, moving closer over time', () => {
    const resultRef = renderHarness(jest.fn(), jest.fn());
    ReactTestRenderer.act(() => resultRef.current!.start());

    // +10ms buffer: landing exactly on the moment runApproachSequence schedules
    // step 0's own 0ms timer is a jest fake-timer boundary case (whether a
    // timer registered mid-flush at the very edge of the window also fires
    // within that same advance is ambiguous) — a hair past it is unambiguous.
    advance(
      TIMING.countdownSeconds * 1000 + TIMING.settingsOpenDwellMs + TIMING.toggleDwellMs + TIMING.closeDwellMs + 10,
    );
    const firstSeen = useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID];
    expect(firstSeen).toBeDefined();
    expect(firstSeen.isRelay).toBe(false);
    const firstRssi = firstSeen.rawRssi;

    advance((APPROACH_STEP_COUNT - 1) * TIMING.approachStepMs);
    const lastSeen = useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID];
    // Closer + stronger by the end of the approach than at the first sighting.
    expect(lastSeen.rawRssi).toBeGreaterThan(firstRssi);
  });

  it('walks each relayed beacon in from farther out, rather than having it appear already in place', () => {
    const resultRef = renderHarness(jest.fn(), jest.fn());
    ReactTestRenderer.act(() => resultRef.current!.start());

    const runStartMs =
      TIMING.countdownSeconds * 1000 + TIMING.settingsOpenDwellMs + TIMING.toggleDwellMs + TIMING.closeDwellMs;
    const settled = computeRelayedBeaconPosition(0, FALLBACK_ORIGIN.lat, FALLBACK_ORIGIN.lon);

    advance(runStartMs + TIMING.relayStartDelayMs + 10);
    for (const id of RELAYED_BEACON_IDS.slice(1)) {
      expect(useBeaconStore.getState().discoveredBeacons[id]).toBeUndefined();
    }
    const firstSeen = useBeaconStore.getState().discoveredBeacons[RELAYED_BEACON_IDS[0]];
    expect(firstSeen?.isRelay).toBe(true);
    expect(firstSeen.rawRssi).toBeLessThan(settled.rawRssi); // weaker/farther than where it'll settle

    advance(relayedSettleAtMs(0) - TIMING.relayStartDelayMs + 10);
    const finalSeen = useBeaconStore.getState().discoveredBeacons[RELAYED_BEACON_IDS[0]];
    expect(finalSeen.rawRssi).toBeCloseTo(settled.rawRssi, 5);
  });

  it("brings the whole group in with staggered, varied pacing — not in lockstep, and all settled before the peer's own approach finishes", () => {
    const resultRef = renderHarness(jest.fn(), jest.fn());
    ReactTestRenderer.act(() => resultRef.current!.start());

    const runStartMs =
      TIMING.countdownSeconds * 1000 + TIMING.settingsOpenDwellMs + TIMING.toggleDwellMs + TIMING.closeDwellMs;
    const settleTimes = RELAYED_BEACON_IDS.map((_, index) => relayedSettleAtMs(index));
    const lastSettleMs = Math.max(...settleTimes);
    const approachCompletesAtMs = (APPROACH_STEP_COUNT - 1) * TIMING.approachStepMs;

    // The whole group is in before the peer's own approach is done — this is
    // what makes it overlap with the walk rather than following it.
    expect(lastSettleMs).toBeLessThan(approachCompletesAtMs);
    // Not everyone takes the same time to arrive — the "natural, not lockstep" part.
    expect(new Set(settleTimes).size).toBeGreaterThan(1);

    advance(runStartMs + lastSettleMs + 10);

    for (const [index, id] of RELAYED_BEACON_IDS.entries()) {
      const settled = computeRelayedBeaconPosition(index, FALLBACK_ORIGIN.lat, FALLBACK_ORIGIN.lon);
      const actual = useBeaconStore.getState().discoveredBeacons[id];
      expect(actual?.isRelay).toBe(true);
      expect(actual.rawRssi).toBeCloseTo(settled.rawRssi, 5);
    }

    // The peer itself hasn't reached its final position/strength yet.
    const finalStep = computeApproachStep(APPROACH_STEP_COUNT - 1, FALLBACK_ORIGIN.lat, FALLBACK_ORIGIN.lon);
    const peerNow = useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID];
    expect(peerNow.rawRssi).toBeLessThan(finalStep.rawRssi);
  });

  it('cancel mid-run clears every simulated beacon, restores the prior assembly-point state, and stops all timers', () => {
    useSettingsStore.setState({ isAssemblyPoint: false });
    const resultRef = renderHarness(jest.fn(), jest.fn());

    ReactTestRenderer.act(() => resultRef.current!.start());
    advance(TIMING.countdownSeconds * 1000 + TIMING.settingsOpenDwellMs); // isAssemblyPoint now true, mid-run
    expect(useSettingsStore.getState().isAssemblyPoint).toBe(true);

    ReactTestRenderer.act(() => resultRef.current!.cancel());

    expect(resultRef.current!.phase).toBe('idle');
    expect(useSettingsStore.getState().isAssemblyPoint).toBe(false); // restored to pre-run value
    expect(useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID]).toBeUndefined();

    const pendingTimers = jest.getTimerCount();
    advance(60_000);
    // Nothing left scheduled — no beacon should appear no matter how far time is advanced.
    expect(jest.getTimerCount()).toBe(pendingTimers);
    expect(useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID]).toBeUndefined();
  });

  it('holds the scene indefinitely after the scripted sequence finishes (does not go stale/disappear on its own)', () => {
    const resultRef = renderHarness(jest.fn(), jest.fn());
    ReactTestRenderer.act(() => resultRef.current!.start());

    advance(
      TIMING.countdownSeconds * 1000 +
        TIMING.settingsOpenDwellMs +
        TIMING.toggleDwellMs +
        TIMING.closeDwellMs +
        APPROACH_STEP_COUNT * TIMING.approachStepMs +
        500,
    );
    expect(resultRef.current!.phase).toBe('running');

    // Long past every scripted step — the keep-alive should still be refreshing
    // the beacons rather than letting the natural staleness prune erase them.
    advance(TIMING.keepAliveIntervalMs * 3);
    expect(resultRef.current!.phase).toBe('running');
    expect(useBeaconStore.getState().discoveredBeacons[APPROACHING_PEER_ID]).toBeDefined();
    for (const id of RELAYED_BEACON_IDS) {
      expect(useBeaconStore.getState().discoveredBeacons[id]).toBeDefined();
    }
  });
});
