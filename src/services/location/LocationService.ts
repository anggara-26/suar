import Geolocation, {
  type GeoPosition,
  type GeoError,
} from 'react-native-geolocation-service';

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type LocationListener = (sample: LocationSample) => void;
export type LocationErrorListener = (message: string) => void;

function toSample(position: GeoPosition): LocationSample {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

let watchId: number | null = null;

/**
 * Watches the device location, always at high accuracy.
 *
 * Provider choice belongs to the library, not to us: it uses Play Services'
 * fused provider (which blends GPS/wifi/cell itself) and falls back to
 * LocationManager's getBestProvider() where Play Services is absent. Asking it
 * for anything less than high accuracy hands back a coarse, ~100m fix — and
 * this sample is both the map's origin and the position we broadcast, so a
 * coarse one doesn't just blur our own view, it tells every other device we're
 * somewhere we aren't. A device that can't produce a real fix must fall through
 * to the (0, 0) placeholder instead (see useBleLifecycle's refreshOwnFrame),
 * which keeps it honestly in the "direction unknown" strip.
 */
export function startWatchingLocation(onLocation: LocationListener, onError?: LocationErrorListener): void {
  if (watchId !== null) return;

  watchId = Geolocation.watchPosition(
    (position) => onLocation(toSample(position)),
    (error: GeoError) => onError?.(error.message),
    { enableHighAccuracy: true, distanceFilter: 0, interval: 3000 },
  );
}

export function stopWatchingLocation(): void {
  if (watchId === null) return;
  Geolocation.clearWatch(watchId);
  watchId = null;
}

export function getCurrentLocation(): Promise<LocationSample> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(toSample(position)),
      (error: GeoError) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
