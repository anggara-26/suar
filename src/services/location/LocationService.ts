import Geolocation, {
  type GeolocationResponse,
  type GeolocationError,
} from '@react-native-community/geolocation';

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type LocationListener = (sample: LocationSample) => void;
export type LocationErrorListener = (message: string) => void;

function toSample(position: GeolocationResponse): LocationSample {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

let watchId: number | null = null;

/**
 * GPS is satellite-based, not cellular — it keeps working with no signal bars
 * and no wifi, which is the whole premise of the app. This wrapper never
 * touches any network API.
 */
export function startWatchingLocation(onLocation: LocationListener, onError?: LocationErrorListener): void {
  if (watchId !== null) return;
  watchId = Geolocation.watchPosition(
    (position) => onLocation(toSample(position)),
    (error: GeolocationError) => onError?.(error.message),
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
      (error: GeolocationError) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
