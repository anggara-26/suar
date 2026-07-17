/* eslint-disable no-bitwise -- this file packs/unpacks a binary wire format */
import { BeaconType, type BeaconObservation } from '@/src/types/beacon';
import { PROTOCOL_VERSION } from '@/src/protocol/constants';
import { deviceIdToBytes, bytesToDeviceId } from '@/src/protocol/deviceId';

/**
 * Wire format (19 bytes total, 1 byte of headroom inside the ~20-byte
 * manufacturer-data budget a single BLE advertisement can carry):
 *
 *   byte 0      flags: bit0 beaconType, bit1 isRelay, bits2-3 protocolVersion, bits4-7 hopsRemaining
 *   bytes 1-3   deviceId (3 bytes)
 *   bytes 4-7   latitude  (int32, degrees * 1e7)
 *   bytes 8-11  longitude (int32, degrees * 1e7)
 *   bytes 12-15 timestamp (uint32, unix seconds)
 *   bytes 16-17 sequence  (uint16, monotonic per-device counter)
 *   byte 18     accuracy  (uint8, metres; 255 = unknown or worse than 254)
 */
export const PAYLOAD_BYTE_LENGTH = 19;
export const MAX_MANUFACTURER_DATA_BYTES = 20;

/**
 * Saturating value for the accuracy byte. Deliberately the pessimistic end: a
 * receiver treats it as "this position could be a quarter-kilometre out", so a
 * sender that can't measure its own accuracy degrades to no-direction rather
 * than claiming a precision it never had.
 */
export const ACCURACY_UNKNOWN_METERS = 255;

export interface EncodeBeaconInput {
  deviceId: string;
  beaconType: BeaconType;
  isRelay: boolean;
  hopsRemaining: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  sequence: number;
  /** The sender's own GPS accuracy in metres — what lets a receiver judge this fix. */
  accuracyMeters: number;
}

function int32ToBytes(value: number): number[] {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setInt32(0, value, false);
  return Array.from(new Uint8Array(buffer));
}

function uint32ToBytes(value: number): number[] {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, false);
  return Array.from(new Uint8Array(buffer));
}

function uint16ToBytes(value: number): number[] {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setUint16(0, value, false);
  return Array.from(new Uint8Array(buffer));
}

/** Non-finite accuracy can't be trusted, so it saturates to "unknown" rather than to 0 ("perfect"). */
function toAccuracyByte(accuracyMeters: number): number {
  if (!Number.isFinite(accuracyMeters)) return ACCURACY_UNKNOWN_METERS;
  return Math.min(ACCURACY_UNKNOWN_METERS, Math.max(0, Math.round(accuracyMeters)));
}

export function encodeBeacon(input: EncodeBeaconInput): number[] {
  const flags =
    ((input.beaconType & 0b1) << 0) |
    ((input.isRelay ? 1 : 0) << 1) |
    ((PROTOCOL_VERSION & 0b11) << 2) |
    ((input.hopsRemaining & 0b1111) << 4);

  const [id0, id1, id2] = deviceIdToBytes(input.deviceId);
  const latInt = Math.round(input.latitude * 1e7);
  const lonInt = Math.round(input.longitude * 1e7);
  const tsSeconds = Math.floor(input.timestamp / 1000);

  const bytes: number[] = [
    flags,
    id0,
    id1,
    id2,
    ...int32ToBytes(latInt),
    ...int32ToBytes(lonInt),
    ...uint32ToBytes(tsSeconds),
    ...uint16ToBytes(input.sequence & 0xffff),
    toAccuracyByte(input.accuracyMeters),
  ];

  if (bytes.length !== PAYLOAD_BYTE_LENGTH) {
    throw new Error(
      `Encoded beacon payload must be exactly ${PAYLOAD_BYTE_LENGTH} bytes, got ${bytes.length}`,
    );
  }
  if (bytes.length > MAX_MANUFACTURER_DATA_BYTES) {
    throw new Error(
      `Encoded beacon payload exceeds the ${MAX_MANUFACTURER_DATA_BYTES}-byte manufacturer-data budget: got ${bytes.length}`,
    );
  }

  return bytes;
}

export function decodeBeacon(rawBytes: number[]): BeaconObservation {
  if (rawBytes.length < PAYLOAD_BYTE_LENGTH) {
    throw new Error(
      `Beacon payload too short: expected ${PAYLOAD_BYTE_LENGTH} bytes, got ${rawBytes.length}`,
    );
  }

  const bytes = rawBytes.slice(0, PAYLOAD_BYTE_LENGTH);
  const view = new DataView(new Uint8Array(bytes).buffer);

  const flags = bytes[0];
  const beaconType: BeaconType = (flags & 0b1) as BeaconType;
  const isRelay = ((flags >> 1) & 0b1) === 1;
  const protocolVersion = (flags >> 2) & 0b11;
  const hopsRemaining = (flags >> 4) & 0b1111;

  // A mismatched version means the fields below don't mean what we think they
  // do. The length check above only catches a *shorter* payload, so a frame
  // from a newer/older build with the same prefix layout would otherwise parse
  // into plausible-looking garbage rather than being dropped.
  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported beacon protocol version: expected ${PROTOCOL_VERSION}, got ${protocolVersion}`,
    );
  }

  const deviceId = bytesToDeviceId([bytes[1], bytes[2], bytes[3]]);
  const latInt = view.getInt32(4, false);
  const lonInt = view.getInt32(8, false);
  const tsSeconds = view.getUint32(12, false);
  const sequence = view.getUint16(16, false);
  const accuracyMeters = view.getUint8(18);

  return {
    deviceId,
    beaconType,
    isRelay,
    protocolVersion,
    hopsRemaining,
    latitude: latInt / 1e7,
    longitude: lonInt / 1e7,
    timestamp: tsSeconds * 1000,
    sequence,
    accuracyMeters,
  };
}
