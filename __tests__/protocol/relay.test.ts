import { isEligibleForRelay, markRelayed, buildRelayFrame, makeMessageId } from '@/src/protocol/relay';
import { useBeaconStore } from '@/src/state/beaconStore';
import { BeaconType } from '@/src/types/beacon';

const OWN_DEVICE_ID = 'own001';

function makeObservation(overrides: Partial<Parameters<typeof buildRelayFrame>[0]> = {}) {
  return {
    deviceId: 'peer001',
    beaconType: BeaconType.Person,
    isRelay: false,
    protocolVersion: 0,
    hopsRemaining: 1,
    latitude: -6.2,
    longitude: 106.8,
    timestamp: Date.now(),
    sequence: 1,
    accuracyMeters: 12,
    ...overrides,
  };
}

beforeEach(() => {
  // Reset the shared beacon store's dedup set between tests.
  useBeaconStore.setState({ seenMessages: {} });
});

describe('isEligibleForRelay', () => {
  it('is eligible for a fresh, unseen observation with hops remaining', () => {
    expect(isEligibleForRelay(makeObservation(), OWN_DEVICE_ID)).toBe(true);
  });

  it('refuses to relay our own broadcast back to the network', () => {
    const observation = makeObservation({ deviceId: OWN_DEVICE_ID });
    expect(isEligibleForRelay(observation, OWN_DEVICE_ID)).toBe(false);
  });

  it('refuses to relay once hopsRemaining is exhausted', () => {
    const observation = makeObservation({ hopsRemaining: 0 });
    expect(isEligibleForRelay(observation, OWN_DEVICE_ID)).toBe(false);
  });

  it('refuses to re-relay a message it has already forwarded (loop guard)', () => {
    const observation = makeObservation();
    markRelayed(observation);
    expect(isEligibleForRelay(observation, OWN_DEVICE_ID)).toBe(false);
  });

  it('treats the same device with a different sequence as a new, eligible message', () => {
    const first = makeObservation({ sequence: 1 });
    markRelayed(first);
    const second = makeObservation({ sequence: 2 });
    expect(isEligibleForRelay(second, OWN_DEVICE_ID)).toBe(true);
  });
});

describe('buildRelayFrame', () => {
  it('decrements hopsRemaining and sets the relay flag while preserving identity', () => {
    const observation = makeObservation({ hopsRemaining: 2, sequence: 7 });
    const frame = buildRelayFrame(observation);

    expect(frame.isRelay).toBe(true);
    expect(frame.hopsRemaining).toBe(1);
    expect(frame.deviceId).toBe(observation.deviceId);
    expect(frame.sequence).toBe(observation.sequence);
  });

  it("carries the origin's position and accuracy through untouched", () => {
    // A relay that dropped the accuracy would make the origin's coarse fix look
    // precise to everyone downstream — the exact lie the byte exists to prevent.
    const observation = makeObservation({ accuracyMeters: 90 });
    const frame = buildRelayFrame(observation);

    expect(frame.accuracyMeters).toBe(90);
    expect(frame.latitude).toBe(observation.latitude);
    expect(frame.longitude).toBe(observation.longitude);
  });
});

describe('makeMessageId', () => {
  it('combines deviceId and sequence deterministically', () => {
    expect(makeMessageId('abc123', 42)).toBe('abc123:42');
  });
});
