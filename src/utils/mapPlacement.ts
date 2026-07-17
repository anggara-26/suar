import {
  haversineDistanceMeters,
  toLocalEastNorthMeters,
  formatDistance,
  isValidFix,
  type LocalOffsetMeters,
} from '@/src/utils/geo';
import type { BeaconState, RssiBucket } from '@/src/types/beacon';
import type { LocationSample } from '@/src/services/location/LocationService';

export interface MapPlacement {
  /**
   * North-up world offset from "you", in metres. Null only when neither fix
   * exists at all — once both devices have a real GPS position we always have
   * *some* vector between them, even if `isApproximate` says not to trust its
   * direction too literally.
   */
  offset: LocalOffsetMeters | null;
  /** Real GPS separation whenever both fixes are valid, even when `offset` is null. */
  distanceMeters: number | null;
  /** Real metres when we have them, otherwise the RSSI bucket's coarse label. */
  distanceLabel: string;
  /**
   * True when `offset` comes from two fixes that are closer together than
   * their combined GPS error — the bearing is noisier than the map lets on, so
   * the dot should say so rather than sit there looking as certain as any other.
   */
  isApproximate: boolean;
}

/**
 * A GPS-delta bearing is only meaningful when the two phones are farther apart
 * than their combined position error — below that, the computed direction is
 * dominated by GPS noise and would point somewhere random. Both halves of that
 * error are measured now: ours from our own fix, theirs from the accuracy they
 * broadcast (see beaconCodec's wire format), so nothing here has to assume.
 */
const MIN_BEARING_DISTANCE_FLOOR_METERS = 2;

/**
 * An unreadable accuracy has to widen the gate, never narrow it. Also guards a
 * sharp edge: Math.max(floor, NaN) is NaN and every `>= NaN` is false, so one
 * bad value would silently switch placement off forever instead of failing.
 */
const UNTRUSTED_ACCURACY_METERS = 255;

function toMetresOfError(accuracyMeters: number): number {
  if (!Number.isFinite(accuracyMeters)) return UNTRUSTED_ACCURACY_METERS;
  return Math.max(0, accuracyMeters);
}

const RSSI_RING_LABEL: Record<RssiBucket, string> = {
  'very-near': 'Very near',
  near: 'Near',
  medium: 'Medium',
  far: 'Far',
};

/**
 * Places a beacon relative to "you" for the map.
 *
 * Distance and direction earn trust at different distances. Two fixes 4 m
 * apart give a solid distance but a bearing dominated by GPS noise — but a
 * noisy vector is still a vector, and the map would rather show it flagged
 * `isApproximate` than hide it and make the beacon disappear. Only when we
 * have no usable fix at all (missing or the `(0,0)` no-fix-yet placeholder) do
 * we fall back to the RSSI bucket, which carries no position to plot at all.
 *
 * The approximation gate scales with *both* devices' reported error, so a peer
 * with a poor fix needs proportionally more separation before its bearing is
 * trusted outright. Nothing here ever invents an angle from nothing — it only
 * ever draws a real GPS delta, sometimes with a caveat attached.
 */
export function placeBeaconOnMap(
  ownLocation: LocationSample | null,
  beacon: BeaconState,
): MapPlacement {
  const ownFixValid = ownLocation !== null && isValidFix(ownLocation.latitude, ownLocation.longitude);
  const beaconFixValid = isValidFix(beacon.latitude, beacon.longitude);

  if (!ownFixValid || !beaconFixValid) {
    return {
      offset: null,
      distanceMeters: null,
      distanceLabel: RSSI_RING_LABEL[beacon.bucket],
      isApproximate: false,
    };
  }

  const distanceMeters = haversineDistanceMeters(
    ownLocation.latitude,
    ownLocation.longitude,
    beacon.latitude,
    beacon.longitude,
  );
  const distanceLabel = formatDistance(distanceMeters);

  const minBearingDistance = Math.max(
    MIN_BEARING_DISTANCE_FLOOR_METERS,
    toMetresOfError(ownLocation.accuracy) + toMetresOfError(beacon.accuracyMeters),
  );

  return {
    offset: toLocalEastNorthMeters(
      ownLocation.latitude,
      ownLocation.longitude,
      beacon.latitude,
      beacon.longitude,
    ),
    distanceMeters,
    distanceLabel,
    isApproximate: distanceMeters < minBearingDistance,
  };
}

export interface LocatedBeacon {
  beacon: BeaconState;
  offset: LocalOffsetMeters;
  distanceLabel: string;
  isApproximate: boolean;
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
 *
 * `unlocated` is now only the beacons with no real position at all (missing or
 * `(0,0)` fix on either end) — a real-but-noisy vector goes to `located` with
 * `isApproximate: true` rather than being hidden in the strip.
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
      located.push({
        beacon,
        offset: placement.offset,
        distanceLabel: placement.distanceLabel,
        isApproximate: placement.isApproximate,
      });
    } else {
      unlocated.push({ beacon, distanceLabel: placement.distanceLabel });
    }
  }

  return { located, unlocated };
}
