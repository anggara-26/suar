import type { BeaconObservation } from '@/src/types/beacon';
import type { EncodeBeaconInput } from '@/src/protocol/beaconCodec';
import { useBeaconStore } from '@/src/state/beaconStore';

export function makeMessageId(deviceId: string, sequence: number): string {
  return `${deviceId}:${sequence}`;
}

/**
 * Whether an observed beacon should be relayed onward: not our own broadcast,
 * has hops left after decrementing, and we haven't already forwarded this
 * exact message. All three guards are mandatory — without them a mesh floods
 * the channel and drains batteries; this isn't an optimization.
 */
export function isEligibleForRelay(observation: BeaconObservation, ownDeviceId: string): boolean {
  if (observation.deviceId === ownDeviceId) return false;
  if (observation.hopsRemaining <= 0) return false;

  const messageId = makeMessageId(observation.deviceId, observation.sequence);
  return !useBeaconStore.getState().hasSeenMessage(messageId);
}

export function markRelayed(observation: BeaconObservation): void {
  const messageId = makeMessageId(observation.deviceId, observation.sequence);
  useBeaconStore.getState().markMessageSeen(messageId);
}

/** Same identity/content, hop count decremented, relay flag set — the frame a relay rebroadcasts. */
export function buildRelayFrame(observation: BeaconObservation): EncodeBeaconInput {
  return {
    deviceId: observation.deviceId,
    beaconType: observation.beaconType,
    isRelay: true,
    hopsRemaining: observation.hopsRemaining - 1,
    latitude: observation.latitude,
    longitude: observation.longitude,
    timestamp: observation.timestamp,
    sequence: observation.sequence,
    // The origin's accuracy travels with its position — a relay that dropped it
    // would make a coarse fix look precise by the time it reached anyone else.
    accuracyMeters: observation.accuracyMeters,
  };
}
