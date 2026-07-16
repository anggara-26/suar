/* eslint-disable no-bitwise -- this file packs/unpacks a binary wire format */
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Short 3-byte device identity, persisted across app restarts. A device that
 * gets a fresh ID on every launch shows up as a brand-new beacon to everyone
 * who already saw its old ID (and to relays still forwarding old frames), so
 * one phone would appear twice on other radars — persistence is what makes
 * "one phone = one dot" hold across restarts.
 */

const STORAGE_KEY = '@suar/deviceId';
const DEVICE_ID_PATTERN = /^[0-9a-f]{6}$/;

let cachedDeviceId: string | null = null;
let hydratedFromStorage = false;

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function generateDeviceId(): string {
  const bytes = [randomByte(), randomByte(), randomByte()];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Loads the persisted device ID, minting and saving one on first launch.
 * Must resolve before the first broadcast so the on-air identity is stable;
 * useBleLifecycle awaits this during startup. Storage failures degrade to a
 * session-only random ID rather than blocking the app.
 */
export async function loadOrCreateDeviceId(): Promise<string> {
  // getDeviceId() may have already minted a session-random ID (the store reads
  // it at module init), so the cache alone doesn't mean we've checked storage —
  // the persisted ID must win over any pre-hydration random one.
  if (hydratedFromStorage && cachedDeviceId) return cachedDeviceId;

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && DEVICE_ID_PATTERN.test(stored)) {
      cachedDeviceId = stored;
      hydratedFromStorage = true;
      return stored;
    }
  } catch {
    // Fall through to persisting whatever we have.
  }

  const fresh = cachedDeviceId ?? generateDeviceId();
  cachedDeviceId = fresh;
  hydratedFromStorage = true;
  await AsyncStorage.setItem(STORAGE_KEY, fresh).catch(() => {});
  return fresh;
}

/** Synchronous access for callers that run before hydration (store init fallback). */
export function getDeviceId(): string {
  if (!cachedDeviceId) {
    cachedDeviceId = generateDeviceId();
  }
  return cachedDeviceId;
}

export function deviceIdToBytes(deviceId: string): [number, number, number] {
  const clean = deviceId.padStart(6, '0').slice(-6);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function bytesToDeviceId(bytes: [number, number, number]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}
