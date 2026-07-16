/* eslint-disable no-bitwise -- this file packs/unpacks a binary wire format */
/**
 * Short 3-byte device identity, generated once per app session (in-memory only —
 * a hackathon demo doesn't need identity to survive an app restart, and skipping
 * persistence avoids pulling in a storage dependency).
 */

let cachedDeviceId: string | null = null;

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

export function getDeviceId(): string {
  if (!cachedDeviceId) {
    const bytes = [randomByte(), randomByte(), randomByte()];
    cachedDeviceId = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
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
