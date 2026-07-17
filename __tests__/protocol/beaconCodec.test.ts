import {
  encodeBeacon,
  decodeBeacon,
  PAYLOAD_BYTE_LENGTH,
  MAX_MANUFACTURER_DATA_BYTES,
  ACCURACY_UNKNOWN_METERS,
} from '@/src/protocol/beaconCodec';
import { PROTOCOL_VERSION } from '@/src/protocol/constants';
import { BeaconType } from '@/src/types/beacon';

const baseInput = {
  deviceId: 'a1b2c3',
  beaconType: BeaconType.Person,
  isRelay: false,
  hopsRemaining: 1,
  latitude: -6.2088,
  longitude: 106.8456,
  timestamp: 1_700_000_000_000,
  sequence: 42,
  accuracyMeters: 12,
};

describe('beaconCodec', () => {
  it('encodes to exactly the fixed payload length', () => {
    const bytes = encodeBeacon(baseInput);
    expect(bytes).toHaveLength(PAYLOAD_BYTE_LENGTH);
    expect(bytes.length).toBeLessThanOrEqual(MAX_MANUFACTURER_DATA_BYTES);
  });

  it('round-trips all fields through encode -> decode', () => {
    const bytes = encodeBeacon(baseInput);
    const decoded = decodeBeacon(bytes);

    expect(decoded.deviceId).toBe(baseInput.deviceId);
    expect(decoded.beaconType).toBe(baseInput.beaconType);
    expect(decoded.isRelay).toBe(baseInput.isRelay);
    expect(decoded.hopsRemaining).toBe(baseInput.hopsRemaining);
    expect(decoded.sequence).toBe(baseInput.sequence);
    // GPS is fixed-point at 1e7 — expect precision to ~1cm, not exact float equality.
    expect(decoded.latitude).toBeCloseTo(baseInput.latitude, 6);
    expect(decoded.longitude).toBeCloseTo(baseInput.longitude, 6);
    expect(decoded.timestamp).toBe(baseInput.timestamp);
    expect(decoded.accuracyMeters).toBe(baseInput.accuracyMeters);
  });

  it('rounds a fractional accuracy to the nearest metre', () => {
    const bytes = encodeBeacon({ ...baseInput, accuracyMeters: 18.799999237060547 });
    expect(decodeBeacon(bytes).accuracyMeters).toBe(19);
  });

  it('saturates an accuracy beyond the byte range instead of wrapping', () => {
    // 300 % 256 would be 44 — a wrap would turn a hopeless fix into a good one.
    const bytes = encodeBeacon({ ...baseInput, accuracyMeters: 300 });
    expect(decodeBeacon(bytes).accuracyMeters).toBe(ACCURACY_UNKNOWN_METERS);
  });

  it('reports a non-finite accuracy as unknown, never as perfect', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      const bytes = encodeBeacon({ ...baseInput, accuracyMeters: value });
      expect(decodeBeacon(bytes).accuracyMeters).toBe(ACCURACY_UNKNOWN_METERS);
    }
  });

  it('clamps a negative accuracy to zero', () => {
    const bytes = encodeBeacon({ ...baseInput, accuracyMeters: -5 });
    expect(decodeBeacon(bytes).accuracyMeters).toBe(0);
  });

  it('stamps the current protocol version and accepts its own frames', () => {
    const decoded = decodeBeacon(encodeBeacon(baseInput));
    expect(decoded.protocolVersion).toBe(PROTOCOL_VERSION);
  });

  it('rejects a frame from a different protocol version', () => {
    // Same length, same field offsets — only the version bits differ, so
    // without an explicit check this would parse into plausible garbage.
    const bytes = encodeBeacon(baseInput);
    const otherVersion = (PROTOCOL_VERSION + 1) & 0b11;
    bytes[0] = (bytes[0] & ~0b1100) | (otherVersion << 2);

    expect(() => decodeBeacon(bytes)).toThrow(/protocol version/i);
  });

  it('round-trips Assembly beacon type and relay flag', () => {
    const bytes = encodeBeacon({
      ...baseInput,
      beaconType: BeaconType.Assembly,
      isRelay: true,
      hopsRemaining: 3,
    });
    const decoded = decodeBeacon(bytes);

    expect(decoded.beaconType).toBe(BeaconType.Assembly);
    expect(decoded.isRelay).toBe(true);
    expect(decoded.hopsRemaining).toBe(3);
  });

  it('clamps hopsRemaining to its 4-bit field width', () => {
    const bytes = encodeBeacon({ ...baseInput, hopsRemaining: 15 });
    expect(decodeBeacon(bytes).hopsRemaining).toBe(15);
  });

  it('wraps sequence correctly at the uint16 boundary', () => {
    const bytes = encodeBeacon({ ...baseInput, sequence: 65535 });
    expect(decodeBeacon(bytes).sequence).toBe(65535);
  });

  it('throws when decoding a payload shorter than the fixed length', () => {
    expect(() => decodeBeacon([1, 2, 3])).toThrow();
  });
});
