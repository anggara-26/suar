import { placeBeaconOnMap, partitionBeaconsForMap } from '@/src/utils/mapPlacement';
import { BeaconType, type BeaconState } from '@/src/types/beacon';
import type { LocationSample } from '@/src/services/location/LocationService';

const ORIGIN: LocationSample = {
  latitude: -6.2,
  longitude: 106.8,
  accuracy: 5,
  timestamp: 0,
};

/** ~111.32 km per degree of latitude, so 0.001 deg north is ~111 m. */
const HUNDRED_ISH_METERS_NORTH = 0.001;

function makeBeacon(overrides: Partial<BeaconState> = {}): BeaconState {
  return {
    deviceId: 'abc123',
    beaconType: BeaconType.Person,
    isRelay: false,
    protocolVersion: 0,
    hopsRemaining: 3,
    latitude: ORIGIN.latitude + HUNDRED_ISH_METERS_NORTH,
    longitude: ORIGIN.longitude,
    timestamp: 0,
    sequence: 1,
    rawRssi: -60,
    smoothedRssi: -60,
    bucket: 'near',
    lastSeenAt: 0,
    ...overrides,
  };
}

describe('placeBeaconOnMap', () => {
  it('places a far-enough beacon with a real offset and a metre label', () => {
    const placement = placeBeaconOnMap(ORIGIN, makeBeacon());

    expect(placement.offset).not.toBeNull();
    expect(placement.offset!.north).toBeCloseTo(111, 0);
    expect(placement.offset!.east).toBeCloseTo(0, 0);
    expect(placement.distanceMeters).toBeCloseTo(111, 0);
    expect(placement.distanceLabel).toBe('111 m');
  });

  it('signs east and north correctly for a south-west beacon', () => {
    const placement = placeBeaconOnMap(
      ORIGIN,
      makeBeacon({
        latitude: ORIGIN.latitude - HUNDRED_ISH_METERS_NORTH,
        longitude: ORIGIN.longitude - HUNDRED_ISH_METERS_NORTH,
      }),
    );

    expect(placement.offset!.north).toBeLessThan(0);
    expect(placement.offset!.east).toBeLessThan(0);
  });

  it('withholds the offset inside the bearing gate but still reports real metres', () => {
    // ~1.1 m apart: distance is solid, bearing would be pure GPS noise.
    const placement = placeBeaconOnMap(
      ORIGIN,
      makeBeacon({ latitude: ORIGIN.latitude + 0.00001 }),
    );

    expect(placement.offset).toBeNull();
    expect(placement.distanceMeters).toBeCloseTo(1.1, 0);
    expect(placement.distanceLabel).toBe('1 m');
  });

  it('widens the gate as own accuracy degrades', () => {
    // 111 m clears the 20 m floor, but not a 100 + 15 m error budget.
    const placement = placeBeaconOnMap({ ...ORIGIN, accuracy: 100 }, makeBeacon());

    expect(placement.offset).toBeNull();
    expect(placement.distanceMeters).toBeCloseTo(111, 0);
  });

  it('falls back to the RSSI bucket label when we have no own fix', () => {
    const placement = placeBeaconOnMap(null, makeBeacon({ bucket: 'medium' }));

    expect(placement.offset).toBeNull();
    expect(placement.distanceMeters).toBeNull();
    expect(placement.distanceLabel).toBe('Medium');
  });

  it('treats the (0,0) no-fix-yet placeholder as no peer fix', () => {
    const placement = placeBeaconOnMap(ORIGIN, makeBeacon({ latitude: 0, longitude: 0, bucket: 'far' }));

    expect(placement.offset).toBeNull();
    expect(placement.distanceMeters).toBeNull();
    expect(placement.distanceLabel).toBe('Far');
  });

  it('still places a beacon when own accuracy is not a number', () => {
    // A NaN accuracy would poison Math.max, and every `>= NaN` is false —
    // that would silently disable positioning rather than fail loudly.
    const placement = placeBeaconOnMap({ ...ORIGIN, accuracy: NaN }, makeBeacon());

    expect(placement.offset).not.toBeNull();
  });
});

describe('partitionBeaconsForMap', () => {
  it('splits placeable beacons from the rest', () => {
    const far = makeBeacon({ deviceId: 'aaaaaa' });
    const tooClose = makeBeacon({ deviceId: 'bbbbbb', latitude: ORIGIN.latitude + 0.00001 });
    const noFix = makeBeacon({ deviceId: 'cccccc', latitude: 0, longitude: 0 });

    const { located, unlocated } = partitionBeaconsForMap(ORIGIN, [far, tooClose, noFix]);

    expect(located.map((entry) => entry.beacon.deviceId)).toEqual(['aaaaaa']);
    expect(unlocated.map((entry) => entry.beacon.deviceId)).toEqual(['bbbbbb', 'cccccc']);
  });
});
