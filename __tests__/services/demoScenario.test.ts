import {
  computeApproachStep,
  computeRelayedBeaconPosition,
  computeRelayedBeaconStep,
  relayedStepCount,
  APPROACH_STEP_COUNT,
  APPROACH_BEARING_DEGREES,
  RELAYED_BEACON_IDS,
  RELAYED_HOPS_REMAINING,
} from '@/src/services/demo/demoScenario';
import { haversineDistanceMeters, bearingDegrees } from '@/src/utils/geo';
import { MAX_HOPS_MESH } from '@/src/protocol/constants';

const ORIGIN = { lat: -6.2, lon: 106.8 };

/** Smallest angular difference between two bearings, accounting for the 0/360 wrap. */
function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

describe('computeApproachStep', () => {
  it('starts far away with a weak signal', () => {
    const first = computeApproachStep(0, ORIGIN.lat, ORIGIN.lon);
    const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, first.latitude, first.longitude);

    expect(distance).toBeCloseTo(180, -1); // within ~tens of metres
    expect(first.rawRssi).toBeLessThan(-80);
  });

  it('ends close by with a strong signal', () => {
    const last = computeApproachStep(APPROACH_STEP_COUNT - 1, ORIGIN.lat, ORIGIN.lon);
    const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, last.latitude, last.longitude);

    expect(distance).toBeCloseTo(8, 0);
    expect(last.rawRssi).toBeGreaterThan(-50);
  });

  it('gets monotonically closer and stronger as the step index increases', () => {
    let previousDistance = Infinity;
    let previousRssi = -Infinity;

    for (let step = 0; step < APPROACH_STEP_COUNT; step += 1) {
      const point = computeApproachStep(step, ORIGIN.lat, ORIGIN.lon);
      const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, point.latitude, point.longitude);

      expect(distance).toBeLessThanOrEqual(previousDistance);
      expect(point.rawRssi).toBeGreaterThanOrEqual(previousRssi);
      previousDistance = distance;
      previousRssi = point.rawRssi;
    }
  });

  it('follows the same path regardless of origin (relative, not a fixed coordinate)', () => {
    const jakarta = computeApproachStep(5, -6.2, 106.8);
    const jakartaDistance = haversineDistanceMeters(-6.2, 106.8, jakarta.latitude, jakarta.longitude);

    const london = computeApproachStep(5, 51.5, -0.1);
    const londonDistance = haversineDistanceMeters(51.5, -0.1, london.latitude, london.longitude);

    expect(londonDistance).toBeCloseTo(jakartaDistance, 0);
    expect(london.rawRssi).toBe(jakarta.rawRssi);
  });
});

describe('computeRelayedBeaconPosition', () => {
  it("places every relayed beacon farther out than the peer's arrival point, so none reads as the one who reached you", () => {
    const approachEnd = haversineDistanceMeters(
      ORIGIN.lat,
      ORIGIN.lon,
      computeApproachStep(APPROACH_STEP_COUNT - 1, ORIGIN.lat, ORIGIN.lon).latitude,
      computeApproachStep(APPROACH_STEP_COUNT - 1, ORIGIN.lat, ORIGIN.lon).longitude,
    );

    RELAYED_BEACON_IDS.forEach((_, index) => {
      const point = computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon);
      const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, point.latitude, point.longitude);
      expect(distance).toBeGreaterThan(approachEnd);
    });
  });

  it("stays within a small angular spread of the peer's own approach bearing, reading as one group", () => {
    RELAYED_BEACON_IDS.forEach((_, index) => {
      const point = computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon);
      const bearing = bearingDegrees(ORIGIN.lat, ORIGIN.lon, point.latitude, point.longitude);
      expect(angularDifference(bearing, APPROACH_BEARING_DEGREES)).toBeLessThanOrEqual(25);
    });
  });

  it("stays closer than the peer's starting distance, so they plausibly sit behind the peer rather than beyond the scene", () => {
    const approachStart = haversineDistanceMeters(
      ORIGIN.lat,
      ORIGIN.lon,
      computeApproachStep(0, ORIGIN.lat, ORIGIN.lon).latitude,
      computeApproachStep(0, ORIGIN.lat, ORIGIN.lon).longitude,
    );

    RELAYED_BEACON_IDS.forEach((_, index) => {
      const point = computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon);
      const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, point.latitude, point.longitude);
      expect(distance).toBeLessThan(approachStart);
    });
  });

  it('gives each of the relayed beacons a distinct position', () => {
    const positions = RELAYED_BEACON_IDS.map((_, index) =>
      computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon),
    );
    const uniqueLatitudes = new Set(positions.map((p) => p.latitude.toFixed(6)));
    expect(uniqueLatitudes.size).toBe(RELAYED_BEACON_IDS.length);
  });
});

describe('computeRelayedBeaconStep', () => {
  it("starts every relayed beacon farther out and weaker than its own resting position — it walks in rather than appearing already settled", () => {
    RELAYED_BEACON_IDS.forEach((_, index) => {
      const resting = computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon);
      const restingDistance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, resting.latitude, resting.longitude);

      const first = computeRelayedBeaconStep(index, 0, ORIGIN.lat, ORIGIN.lon);
      const firstDistance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, first.latitude, first.longitude);

      expect(firstDistance).toBeGreaterThan(restingDistance);
      expect(first.rawRssi).toBeLessThan(resting.rawRssi);
    });
  });

  it('gets monotonically closer and stronger as its own step index increases, ending exactly at its resting position', () => {
    RELAYED_BEACON_IDS.forEach((_, index) => {
      const stepCount = relayedStepCount(index);
      let previousDistance = Infinity;
      let previousRssi = -Infinity;

      for (let step = 0; step < stepCount; step += 1) {
        const point = computeRelayedBeaconStep(index, step, ORIGIN.lat, ORIGIN.lon);
        const distance = haversineDistanceMeters(ORIGIN.lat, ORIGIN.lon, point.latitude, point.longitude);

        expect(distance).toBeLessThanOrEqual(previousDistance);
        expect(point.rawRssi).toBeGreaterThanOrEqual(previousRssi);
        previousDistance = distance;
        previousRssi = point.rawRssi;
      }

      const last = computeRelayedBeaconStep(index, stepCount - 1, ORIGIN.lat, ORIGIN.lon);
      const resting = computeRelayedBeaconPosition(index, ORIGIN.lat, ORIGIN.lon);
      expect(last).toEqual(resting);
    });
  });
});

describe('relayedStepCount', () => {
  it('varies across the group rather than giving every beacon the same pace', () => {
    const counts = new Set(RELAYED_BEACON_IDS.map((_, index) => relayedStepCount(index)));
    expect(counts.size).toBeGreaterThan(1);
  });

  it('is always at least 2 (a walk needs a start and an end)', () => {
    RELAYED_BEACON_IDS.forEach((_, index) => {
      expect(relayedStepCount(index)).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('RELAYED_HOPS_REMAINING', () => {
  it('is below the mesh ceiling, so a relayed fake reads as "arrived via a hop"', () => {
    expect(RELAYED_HOPS_REMAINING).toBeLessThan(MAX_HOPS_MESH);
    expect(RELAYED_HOPS_REMAINING).toBeGreaterThan(0);
  });
});
