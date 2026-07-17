import { fromLocalEastNorthMeters, type LocalOffsetMeters } from '@/src/utils/geo';
import { BeaconType } from '@/src/types/beacon';
import { MAX_HOPS_MESH } from '@/src/protocol/constants';

/**
 * Deliberately fake-looking rather than real-hex-shaped (contrast real IDs
 * like `1eee3f`) — anyone inspecting a recording or a log during the demo can
 * tell these apart from a genuine device at a glance.
 */
export const APPROACHING_PEER_ID = 'd3ad01';
export const RELAYED_BEACON_IDS = [
  'd3ad02', 'd3ad03', 'd3ad04', 'd3ad05', 'd3ad06',
  'd3ad07', 'd3ad08', 'd3ad09', 'd3ad0a', 'd3ad0b',
];

/** Jakarta — used only when the device has no GPS fix of its own to offset from (see useDemoScenario). */
export const FALLBACK_ORIGIN = { lat: -6.2, lon: 106.8 };

export const TIMING = {
  countdownSeconds: 5,
  settingsOpenDwellMs: 1200,
  toggleDwellMs: 1200,
  closeDwellMs: 1000,
  approachDurationMs: 12_000,
  approachStepMs: 800,
  // Relayed beacons start walking shortly after the peer sets off (not after
  // they've arrived — see useDemoScenario, runAssemblyPointSequence), each on
  // its own staggered start so the whole group visibly walks in *with* the
  // peer rather than appearing only once the peer has already settled.
  relayStartDelayMs: 400,
  relayWalkStaggerMs: 500,
  relayWalkStepMs: 800,
  keepAliveIntervalMs: 6000,
} as const;

export const APPROACH_STEP_COUNT = Math.max(2, Math.round(TIMING.approachDurationMs / TIMING.approachStepMs));

const APPROACH_START_METERS = 180;
const APPROACH_END_METERS = 8;
const APPROACH_START_RSSI = -85;
const APPROACH_END_RSSI = -45;
/** Northwest — arbitrary but fixed, so the path is deterministic and testable. Exported so tests
 * can assert the relayed beacons stay near it without hardcoding a second copy of the number. */
export const APPROACH_BEARING_DEGREES = -45;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function offsetAtBearing(distanceMeters: number, bearingDegrees: number): LocalOffsetMeters {
  const bearingRad = (bearingDegrees * Math.PI) / 180;
  return {
    east: distanceMeters * Math.sin(bearingRad),
    north: distanceMeters * Math.cos(bearingRad),
  };
}

export interface SimulatedPosition {
  latitude: number;
  longitude: number;
  rawRssi: number;
}

/**
 * Position + signal strength of the approaching peer at `stepIndex` of
 * `APPROACH_STEP_COUNT` — step 0 is the far/weak start, the last step is the
 * near/strong end. Pure and origin-relative so it's testable without a real
 * GPS fix or a running app.
 */
export function computeApproachStep(
  stepIndex: number,
  originLat: number,
  originLon: number,
): SimulatedPosition {
  const t = stepIndex / (APPROACH_STEP_COUNT - 1);
  const distance = lerp(APPROACH_START_METERS, APPROACH_END_METERS, t);
  const offset = offsetAtBearing(distance, APPROACH_BEARING_DEGREES);
  const { latitude, longitude } = fromLocalEastNorthMeters(originLat, originLon, offset);
  return { latitude, longitude, rawRssi: lerp(APPROACH_START_RSSI, APPROACH_END_RSSI, t) };
}

const RELAYED_BEACON_COUNT = RELAYED_BEACON_IDS.length;
const RELAYED_MIN_DISTANCE_METERS = 50;
const RELAYED_MAX_DISTANCE_METERS = 125;
const RELAYED_MAX_BEARING_SPREAD_DEGREES = 24;
const RELAYED_NEAR_RSSI = -66;
const RELAYED_FAR_RSSI = -82;
/** How much farther out than its own resting spot each relayed beacon starts its walk — same idea
 * as the peer's own approach, just a shorter stretch since they're settling nearby rather than
 * walking all the way in to the main user. */
const RELAYED_WALK_DISTANCE_METERS = 70;
const RELAYED_WALK_START_RSSI = -88;
/** Step counts cycled by index so the group doesn't move in lockstep — a natural spread of walking
 * paces (some arrive a little quicker than others) rather than everyone arriving on the same beat. */
const RELAYED_STEP_COUNTS = [7, 8, 9];

/** How many steps relayed beacon `index`'s own walk takes — exported so useDemoScenario can
 * schedule exactly that many upserts per beacon without duplicating the cycling logic. */
export function relayedStepCount(index: number): number {
  return RELAYED_STEP_COUNTS[index % RELAYED_STEP_COUNTS.length];
}

function relayedRestingDistanceMeters(index: number): number {
  return lerp(RELAYED_MIN_DISTANCE_METERS, RELAYED_MAX_DISTANCE_METERS, index / (RELAYED_BEACON_COUNT - 1));
}

function relayedBearingOffsetDegrees(index: number): number {
  const magnitude = RELAYED_MAX_BEARING_SPREAD_DEGREES * (index / (RELAYED_BEACON_COUNT - 1));
  return index % 2 === 0 ? magnitude : -magnitude;
}

function relayedRestingRssi(index: number): number {
  return lerp(RELAYED_NEAR_RSSI, RELAYED_FAR_RSSI, index / (RELAYED_BEACON_COUNT - 1));
}

/**
 * Position + signal strength of relayed beacon `index` at `stepIndex` of its own walk (see
 * `relayedStepCount`) — the whole point of a relay demo is "reachable *through* the peer who found
 * you," so each walks in along the same bearing the peer approached from (fanned out a little per
 * index, alternating side to side, so the group reads as a loose cluster rather than a single-file
 * line), starting `RELAYED_WALK_DISTANCE_METERS` farther out and weaker than where it settles.
 */
export function computeRelayedBeaconStep(
  index: number,
  stepIndex: number,
  originLat: number,
  originLon: number,
): SimulatedPosition {
  const stepCount = relayedStepCount(index);
  const t = stepIndex / (stepCount - 1);
  const restingDistance = relayedRestingDistanceMeters(index);
  const distanceMeters = lerp(restingDistance + RELAYED_WALK_DISTANCE_METERS, restingDistance, t);
  const rawRssi = lerp(RELAYED_WALK_START_RSSI, relayedRestingRssi(index), t);

  const { latitude, longitude } = fromLocalEastNorthMeters(
    originLat,
    originLon,
    offsetAtBearing(distanceMeters, APPROACH_BEARING_DEGREES + relayedBearingOffsetDegrees(index)),
  );
  return { latitude, longitude, rawRssi };
}

/**
 * Where relayed beacon `index` ends up once its own walk finishes — the resting spot: farther out
 * than the peer's arrival point (8m — so none reads as "the one who reached you") and closer than
 * the peer's starting point (180m — so it plausibly sits behind the peer along the path they walked
 * in on). Also what keep-alive holds it at afterwards.
 */
export function computeRelayedBeaconPosition(index: number, originLat: number, originLon: number): SimulatedPosition {
  return computeRelayedBeaconStep(index, relayedStepCount(index) - 1, originLat, originLon);
}

/** hopsRemaining for a relayed fake — below the mesh ceiling, since it's meant to read as "arrived via a hop," not a fresh direct broadcast. */
export const RELAYED_HOPS_REMAINING = MAX_HOPS_MESH - 1;

export const APPROACHING_PEER_BEACON_TYPE = BeaconType.Person;
