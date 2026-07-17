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
    accuracyMeters: 5,
    rawRssi: -60,
    smoothedRssi: -60,
    bucket: 'near',
    lastSeenAt: 0,
    ...overrides,
  };
}

describe('placeBeaconOnMap', () => {
  it('places a far-enough beacon with a real, trusted offset and a metre label', () => {
    const placement = placeBeaconOnMap(ORIGIN, makeBeacon());

    expect(placement.offset).not.toBeNull();
    expect(placement.offset!.north).toBeCloseTo(111, 0);
    expect(placement.offset!.east).toBeCloseTo(0, 0);
    expect(placement.distanceMeters).toBeCloseTo(111, 0);
    expect(placement.distanceLabel).toBe('111 m');
    expect(placement.isApproximate).toBe(false);
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

  it('flags the offset approximate inside the bearing gate, rather than hiding it', () => {
    // ~1.1 m apart: distance is solid, bearing would be pure GPS noise — but a
    // noisy vector is still a vector, so it's drawn (flagged), not withheld.
    const placement = placeBeaconOnMap(
      ORIGIN,
      makeBeacon({ latitude: ORIGIN.latitude + 0.00001 }),
    );

    expect(placement.offset).not.toBeNull();
    expect(placement.isApproximate).toBe(true);
    expect(placement.distanceMeters).toBeCloseTo(1.1, 0);
    expect(placement.distanceLabel).toBe('1 m');
  });

  it('widens the approximation gate as own accuracy degrades', () => {
    // 111 m apart, but a 120 + 5 m combined error budget can't justify a
    // trusted bearing — same offset, just flagged.
    const placement = placeBeaconOnMap({ ...ORIGIN, accuracy: 120 }, makeBeacon());

    expect(placement.offset).not.toBeNull();
    expect(placement.isApproximate).toBe(true);
    expect(placement.distanceMeters).toBeCloseTo(111, 0);
  });

  it('flags the offset approximate when the peer reports a coarse fix, however good ours is', () => {
    // The whole point of putting accuracy on the wire: a peer that only knows
    // itself to ±200m shouldn't look as certain as one with a tight fix, even
    // though our own fix is excellent and it's 111m away.
    const placement = placeBeaconOnMap(
      { ...ORIGIN, accuracy: 3 },
      makeBeacon({ accuracyMeters: 200 }),
    );

    expect(placement.offset).not.toBeNull();
    expect(placement.isApproximate).toBe(true);
    expect(placement.distanceLabel).toBe('111 m');
  });

  it('trusts the beacon outright when both devices report good fixes', () => {
    const placement = placeBeaconOnMap(
      { ...ORIGIN, accuracy: 5 },
      makeBeacon({ accuracyMeters: 6 }),
    );

    expect(placement.offset).not.toBeNull();
    expect(placement.isApproximate).toBe(false);
  });

  it('treats an unreadable peer accuracy as maximally uncertain, not as perfect', () => {
    const placement = placeBeaconOnMap(ORIGIN, makeBeacon({ accuracyMeters: NaN }));

    expect(placement.offset).not.toBeNull();
    expect(placement.isApproximate).toBe(true);
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

  it('widens the gate rather than poisoning it when own accuracy is not a number', () => {
    // Two different failures to keep apart. A NaN reaching Math.max makes every
    // `>= NaN` false, which would kill placement outright at *any* distance —
    // silently and permanently. Treating the unknown as maximally uncertain
    // instead is a proportionate response: near beacons are flagged
    // approximate, far ones are still trusted outright.
    const near = placeBeaconOnMap({ ...ORIGIN, accuracy: NaN }, makeBeacon());
    expect(near.offset).not.toBeNull();
    expect(near.isApproximate).toBe(true);
    expect(near.distanceMeters).toBeCloseTo(111, 0); // distance still known

    const far = placeBeaconOnMap(
      { ...ORIGIN, accuracy: NaN },
      makeBeacon({ latitude: ORIGIN.latitude + 0.003 }), // ~334m, clears the widened gate
    );
    expect(far.offset).not.toBeNull();
    expect(far.isApproximate).toBe(false);
  });
});

describe('partitionBeaconsForMap', () => {
  it('separates beacons with no real fix from everything with a real position', () => {
    // A beacon too close for a trusted bearing still HAS a position, so it
    // belongs on the map (flagged), not in the no-position strip — only a
    // beacon with no usable fix at all goes to `unlocated`.
    const far = makeBeacon({ deviceId: 'aaaaaa' });
    const tooClose = makeBeacon({ deviceId: 'bbbbbb', latitude: ORIGIN.latitude + 0.00001 });
    const noFix = makeBeacon({ deviceId: 'cccccc', latitude: 0, longitude: 0 });

    const { located, unlocated } = partitionBeaconsForMap(ORIGIN, [far, tooClose, noFix]);

    expect(located.map((entry) => entry.beacon.deviceId)).toEqual(['aaaaaa', 'bbbbbb']);
    expect(unlocated.map((entry) => entry.beacon.deviceId)).toEqual(['cccccc']);

    const flags = Object.fromEntries(located.map((entry) => [entry.beacon.deviceId, entry.isApproximate]));
    expect(flags).toEqual({ aaaaaa: false, bbbbbb: true });
  });
});
