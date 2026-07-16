import {
  encodeBeacon,
  decodeBeacon,
  PAYLOAD_BYTE_LENGTH,
  MAX_MANUFACTURER_DATA_BYTES,
} from '@/src/protocol/beaconCodec';
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
