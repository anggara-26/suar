import { updateBroadcast } from '@/src/services/ble/BroadcastService';
import type { EncodeBeaconInput } from '@/src/protocol/beaconCodec';
import type { BeaconObservation } from '@/src/types/beacon';
import { isEligibleForRelay, markRelayed, buildRelayFrame, makeMessageId } from '@/src/protocol/relay';
import {
  BROADCAST_INTERVAL_MS,
  RELAY_ROTATION_INTERVAL_MS,
  RELAY_ROTATION_MAX_FRAMES,
} from '@/src/protocol/constants';

/**
 * Android supports one active legacy BLE advertising slot per app, so this
 * service is the single place that ever calls updateBroadcast(). It rotates
 * that slot between our own beacon and whatever beacons we're relaying.
 * When there's nothing to relay, it degrades to exactly the old plain
 * heartbeat (own frame only, at BROADCAST_INTERVAL_MS) — Phase 5 doesn't
 * change on-air behavior for the common two-device case.
 */

let ownFrame: EncodeBeaconInput | null = null;
// Insertion-ordered map doubles as the relay set and its own recency eviction.
const relayFrames = new Map<string, EncodeBeaconInput>();

let rotationIndex = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

export function setOwnFrame(frame: EncodeBeaconInput): void {
  ownFrame = frame;
}

/** Called for every observed beacon; queues it for relay if eligible (see protocol/relay.ts guards). */
export function registerObservedBeacon(observation: BeaconObservation, ownDeviceId: string): void {
  if (!isEligibleForRelay(observation, ownDeviceId)) return;

  const key = makeMessageId(observation.deviceId, observation.sequence);
  if (relayFrames.has(key)) return;

  markRelayed(observation);
  relayFrames.set(key, buildRelayFrame(observation));

  if (relayFrames.size > RELAY_ROTATION_MAX_FRAMES) {
    const oldestKey = relayFrames.keys().next().value;
    if (oldestKey !== undefined) relayFrames.delete(oldestKey);
  }
}

function tick(): void {
  const frames = [ownFrame, ...relayFrames.values()].filter(
    (frame): frame is EncodeBeaconInput => frame !== null,
  );

  if (frames.length > 0) {
    const frame = frames[rotationIndex % frames.length];
    rotationIndex += 1;
    updateBroadcast(frame).catch(() => {});
  }

  const nextDelay = relayFrames.size > 0 ? RELAY_ROTATION_INTERVAL_MS : BROADCAST_INTERVAL_MS;
  timer = setTimeout(tick, nextDelay);
}

export function startRotation(): void {
  if (isRunning) return;
  isRunning = true;
  rotationIndex = 0;
  tick();
}

export function stopRotation(): void {
  isRunning = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  relayFrames.clear();
}
