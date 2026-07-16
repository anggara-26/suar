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

/** How often to poll the network provider while GPS is producing nothing. */
const NETWORK_FALLBACK_INTERVAL_MS = 8000;

/**
 * How long GPS must be silent before a network fix is allowed to stand in.
 * GPS is authoritative whenever it's producing — both for accuracy and for the
 * app's premise (a satellite fix survives with no towers or wifi). A phone with
 * a live GPS watch clears this window on every tick, so its network polls are
 * always discarded; only a device that GPS can't serve ever uses one.
 */
export const GPS_CONSIDERED_STALE_MS = 12000;

/** True when GPS has gone quiet long enough that a network fix should be used instead. */
export function isGpsStale(lastGpsFixAt: number, now: number): boolean {
  return now - lastGpsFixAt >= GPS_CONSIDERED_STALE_MS;
}

let watchId: number | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let lastGpsFixAt = 0;

/**
 * Watches the device location, preferring GPS and falling back to the network
 * provider only when GPS yields nothing.
 *
 * GPS is satellite-based, not cellular — it keeps working with no signal bars
 * and no wifi, which is the premise of the app, so it stays the primary source.
 * But some devices (e.g. wifi-only tablets with no satellite receiver) have a
 * GPS provider that is "enabled" yet never returns a fix; the underlying
 * library then sticks to GPS forever and never tries anything else. The network
 * poll below covers exactly that case, gated on GPS being stale so it never
 * overrides a phone's live satellite fix.
 */
export function startWatchingLocation(onLocation: LocationListener, onError?: LocationErrorListener): void {
  if (watchId !== null) return;

  console.log('[loc] BUNDLE_MARKER_v2 startWatchingLocation called');

  watchId = Geolocation.watchPosition(
    (position) => {
      console.log('[loc] GPS watch fix acc=', position.coords.accuracy);
      lastGpsFixAt = Date.now();
      onLocation(toSample(position));
    },
    (error: GeoError) => onError?.(error.message),
    { enableHighAccuracy: true, distanceFilter: 0, interval: 3000 },
  );

  fallbackTimer = setInterval(() => {
    if (!isGpsStale(lastGpsFixAt, Date.now())) return;
    console.log('[loc] GPS stale, polling network...');
    Geolocation.getCurrentPosition(
      (position) => {
        console.log('[loc] NETWORK fallback fix acc=', position.coords.accuracy);
        // GPS may have delivered a fix while this request was in flight; if so,
        // let it win rather than clobbering it with a coarser network sample.
        if (!isGpsStale(lastGpsFixAt, Date.now())) return;
        onLocation(toSample(position));
      },
      (error) => console.log('[loc] NETWORK fallback error:', error.code, error.message),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
    );
  }, NETWORK_FALLBACK_INTERVAL_MS);
}

export function stopWatchingLocation(): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (fallbackTimer !== null) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  lastGpsFixAt = 0;
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
