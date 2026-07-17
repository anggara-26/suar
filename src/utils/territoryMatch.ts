import { haversineDistanceMeters, isValidFix } from '@/src/utils/geo';
import type { LocationSample } from '@/src/services/location/LocationService';
import type { Territory } from '@/src/types/education';

/**
 * Finds the territory whose centroid is closest to the phone's own GPS fix.
 * Deliberately not point-in-polygon: each territory is one centroid point, so
 * this can be wrong for a phone right at a border, in exchange for the whole
 * territory dataset staying kilobytes instead of megabytes of boundary
 * geometry, and needing no polygon-containment code at all.
 */
export function findNearestTerritory(
  location: LocationSample | null,
  territories: Territory[],
): Territory | null {
  if (location === null || !isValidFix(location.latitude, location.longitude)) return null;
  if (territories.length === 0) return null;

  let nearest = territories[0];
  let nearestDistance = haversineDistanceMeters(
    location.latitude,
    location.longitude,
    nearest.centroid.lat,
    nearest.centroid.lon,
  );

  for (const territory of territories.slice(1)) {
    const distance = haversineDistanceMeters(
      location.latitude,
      location.longitude,
      territory.centroid.lat,
      territory.centroid.lon,
    );
    if (distance < nearestDistance) {
      nearest = territory;
      nearestDistance = distance;
    }
  }

  return nearest;
}
