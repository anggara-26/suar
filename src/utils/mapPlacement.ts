import {
  haversineDistanceMeters,
  toLocalEastNorthMeters,
  formatDistance,
  type LocalOffsetMeters,
} from '@/src/utils/geo';
import type { BeaconState, RssiBucket } from '@/src/types/beacon';
import type { LocationSample } from '@/src/services/location/LocationService';

export interface MapPlacement {
  /**
   * North-up world offset from "you", in metres. Null when we don't have a
   * direction we'd stand behind — the map simply doesn't draw those.
   */
  offset: LocalOffsetMeters | null;
  /** Real GPS separation whenever both fixes are valid, even when `offset` is null. */
  distanceMeters: number | null;
  /** Real metres when we have them, otherwise the RSSI bucket's coarse label. */
  distanceLabel: string;
}

/**
 * A GPS-delta bearing is only meaningful when the two phones are farther apart
 * than their combined position error — below that, the computed direction is
 * dominated by GPS noise and would point somewhere random. The peer's accuracy
 * isn't in the wire format, so assume a typical outdoor fix for their half.
 */
const ASSUMED_PEER_ACCURACY_METERS = 15;
const MIN_BEARING_DISTANCE_FLOOR_METERS = 2;

const RSSI_RING_LABEL: Record<RssiBucket, string> = {
  'very-near': 'Very near',
  near: 'Near',
  medium: 'Medium',
  far: 'Far',
};

function isValidFix(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

/**
 * Places a beacon relative to "you" for the map.
 *
 * Distance and direction are answered separately because they earn trust at
 * different distances. Two fixes 4 m apart give a solid distance but a bearing
 * that is pure noise, so the bearing gate below nulls `offset` while leaving
 * `distanceMeters` intact — the beacon drops off the map but still reports
 * "4 m" rather than a vague "Very near". Only when we have no usable fix at
 * all do we fall back to the RSSI bucket, which carries no direction by
 * construction. Nothing here ever invents an angle.
 */
export function placeBeaconOnMap(
  ownLocation: LocationSample | null,
  beacon: BeaconState,
): MapPlacement {
  const ownFixValid = ownLocation !== null && isValidFix(ownLocation.latitude, ownLocation.longitude);
  const beaconFixValid = isValidFix(beacon.latitude, beacon.longitude);

  if (!ownFixValid || !beaconFixValid) {
    return { offset: null, distanceMeters: null, distanceLabel: RSSI_RING_LABEL[beacon.bucket] };
  }

  const distanceMeters = haversineDistanceMeters(
    ownLocation.latitude,
    ownLocation.longitude,
    beacon.latitude,
    beacon.longitude,
  );
  const distanceLabel = formatDistance(distanceMeters);

  // A non-finite accuracy would poison Math.max into NaN, and every `>= NaN`
  // is false — that would silently switch positioning off forever rather than
  // fail loudly, so treat a missing accuracy as "trust the floor only".
  const ownAccuracy = Number.isFinite(ownLocation.accuracy) ? ownLocation.accuracy : 0;
  const minBearingDistance = Math.max(
    MIN_BEARING_DISTANCE_FLOOR_METERS,
    ownAccuracy + ASSUMED_PEER_ACCURACY_METERS,
  );

  if (distanceMeters < minBearingDistance) {
    return { offset: null, distanceMeters, distanceLabel };
  }

  return {
    offset: toLocalEastNorthMeters(
      ownLocation.latitude,
      ownLocation.longitude,
      beacon.latitude,
      beacon.longitude,
    ),
    distanceMeters,
    distanceLabel,
  };
}

export interface LocatedBeacon {
  beacon: BeaconState;
  offset: LocalOffsetMeters;
  distanceLabel: string;
}

export interface UnlocatedBeacon {
  beacon: BeaconState;
  distanceLabel: string;
}

/**
 * Splits the discovered beacons into the two things the screen renders: dots
 * on the map, and chips in the strip below it. Callers should partition once
 * and pass both halves down — the map and the list want the same placement,
 * and computing it twice is how they drift apart.
 */
export function partitionBeaconsForMap(
  ownLocation: LocationSample | null,
  beacons: BeaconState[],
): { located: LocatedBeacon[]; unlocated: UnlocatedBeacon[] } {
  const located: LocatedBeacon[] = [];
  const unlocated: UnlocatedBeacon[] = [];

  for (const beacon of beacons) {
    const placement = placeBeaconOnMap(ownLocation, beacon);
    if (placement.offset) {
      located.push({ beacon, offset: placement.offset, distanceLabel: placement.distanceLabel });
    } else {
      unlocated.push({ beacon, distanceLabel: placement.distanceLabel });
    }
  }

  return { located, unlocated };
}
