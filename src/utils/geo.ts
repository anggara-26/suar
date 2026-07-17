const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * True bearing (0-360, 0 = north) from point 1 to point 2. Pure GPS geometry —
 * does not require a compass. This is different from "which way should you
 * turn," which additionally needs to know which way the phone itself is
 * facing (see plan decision #4: voice guidance never claims that without
 * compass+GPS both solid).
 */
export function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * True for a real GPS fix — finite coordinates that aren't the `(0, 0)`
 * "no fix yet" placeholder broadcast before a device's first GPS lock (see
 * beaconCodec's wire format). Shared by anything that has to tell a real
 * position apart from that placeholder, e.g. map placement and
 * territory matching.
 */
export function isValidFix(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

export interface LocalOffsetMeters {
  /** Metres east of the origin; negative is west. */
  east: number;
  /** Metres north of the origin; negative is south. */
  north: number;
}

/**
 * Projects a point onto a local east/north plane centred on the origin —
 * the natural frame for a player-centric map, where the origin is "you".
 *
 * Equirectangular rather than a full projection: over the few hundred metres a
 * BLE mesh can span it agrees with haversine to well under a metre, and unlike
 * a bearing+distance polar pair it composes with a rotation as a plain 2D
 * vector, so the map view can rotate the whole world with one transform.
 */
export function toLocalEastNorthMeters(
  originLat: number,
  originLon: number,
  lat: number,
  lon: number,
): LocalOffsetMeters {
  return {
    east: toRadians(lon - originLon) * Math.cos(toRadians(originLat)) * EARTH_RADIUS_METERS,
    north: toRadians(lat - originLat) * EARTH_RADIUS_METERS,
  };
}
