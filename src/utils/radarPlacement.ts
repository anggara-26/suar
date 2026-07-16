import { haversineDistanceMeters, bearingDegrees, formatDistance } from '@/src/utils/geo';
import type { BeaconState, RssiBucket } from '@/src/types/beacon';
import type { LocationSample } from '@/src/services/location/LocationService';

export interface RadarPoint {
  /** -1..1, relative to center. */
  x: number;
  /** -1..1, relative to center; negative is "up" (true north). */
  y: number;
  /** True when placed on a true-north GPS bearing; false when only an RSSI-distance guess. */
  isApproximate: boolean;
  distanceLabel: string;
}

const MAX_DISPLAY_DISTANCE_METERS = 300;

const RSSI_RING_RADIUS: Record<RssiBucket, number> = {
  'very-near': 0.15,
  near: 0.4,
  medium: 0.7,
  far: 0.95,
};

const RSSI_RING_LABEL: Record<RssiBucket, string> = {
  'very-near': 'Very near',
  near: 'Near',
  medium: 'Medium',
  far: 'Far',
};

function isValidFix(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

/** Stable per-device pseudo-angle so an RSSI-only dot doesn't jump around between renders. */
function hashAngleDegrees(deviceId: string): number {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) % 360;
  }
  return hash;
}

function angleToPoint(angleDegrees: number, radius: number): { x: number; y: number } {
  const angleRad = (angleDegrees * Math.PI) / 180;
  return { x: Math.sin(angleRad) * radius, y: -Math.cos(angleRad) * radius };
}

/**
 * Places a beacon on the radar. Prefers a real GPS-delta bearing (true-north-up
 * — this only claims the target's direction relative to true north, never the
 * phone's own facing direction, so it doesn't need a compass). Falls back to an
 * RSSI-distance ring at a stable-but-arbitrary angle when a real bearing isn't
 * computable (missing/placeholder GPS on either end) — flagged `isApproximate`
 * so the UI can visually distinguish it and never silently imply a bearing we
 * don't actually have.
 */
export function placeBeaconOnRadar(
  ownLocation: LocationSample | null,
  beacon: BeaconState,
): RadarPoint {
  const ownFixValid = ownLocation !== null && isValidFix(ownLocation.latitude, ownLocation.longitude);
  const beaconFixValid = isValidFix(beacon.latitude, beacon.longitude);

  if (ownFixValid && beaconFixValid) {
    const distanceMeters = haversineDistanceMeters(
      ownLocation.latitude,
      ownLocation.longitude,
      beacon.latitude,
      beacon.longitude,
    );
    const bearing = bearingDegrees(
      ownLocation.latitude,
      ownLocation.longitude,
      beacon.latitude,
      beacon.longitude,
    );
    const normalizedDistance = Math.min(distanceMeters / MAX_DISPLAY_DISTANCE_METERS, 1);
    const point = angleToPoint(bearing, normalizedDistance);

    return { ...point, isApproximate: false, distanceLabel: formatDistance(distanceMeters) };
  }

  const point = angleToPoint(hashAngleDegrees(beacon.deviceId), RSSI_RING_RADIUS[beacon.bucket]);
  return { ...point, isApproximate: true, distanceLabel: RSSI_RING_LABEL[beacon.bucket] };
}
