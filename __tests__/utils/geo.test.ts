import {
  haversineDistanceMeters,
  bearingDegrees,
  toLocalEastNorthMeters,
  fromLocalEastNorthMeters,
} from '@/src/utils/geo';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMeters(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });

  it('matches the known London -> Paris great-circle distance (~344 km)', () => {
    const distance = haversineDistanceMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance / 1000).toBeCloseTo(344, -1); // within ~10km
  });
});

describe('bearingDegrees', () => {
  it('reports due north as 0 degrees', () => {
    expect(bearingDegrees(0, 0, 1, 0)).toBeCloseTo(0, 1);
  });

  it('reports due east as 90 degrees', () => {
    expect(bearingDegrees(0, 0, 0, 1)).toBeCloseTo(90, 1);
  });

  it('reports due south as 180 degrees', () => {
    expect(bearingDegrees(0, 0, -1, 0)).toBeCloseTo(180, 1);
  });

  it('reports due west as 270 degrees', () => {
    expect(bearingDegrees(0, 0, 0, -1)).toBeCloseTo(270, 1);
  });
});

describe('toLocalEastNorthMeters', () => {
  it('returns the origin for an identical point', () => {
    expect(toLocalEastNorthMeters(-6.2, 106.8, -6.2, 106.8)).toEqual({ east: 0, north: 0 });
  });

  it('maps a northward delta to +north only', () => {
    const offset = toLocalEastNorthMeters(-6.2, 106.8, -6.199, 106.8);

    expect(offset.north).toBeCloseTo(111, 0);
    expect(offset.east).toBeCloseTo(0, 5);
  });

  it('maps an eastward delta to +east only', () => {
    const offset = toLocalEastNorthMeters(-6.2, 106.8, -6.2, 106.801);

    expect(offset.east).toBeGreaterThan(0);
    expect(offset.north).toBeCloseTo(0, 5);
  });

  it('signs south and west negatively', () => {
    const offset = toLocalEastNorthMeters(-6.2, 106.8, -6.201, 106.799);

    expect(offset.north).toBeLessThan(0);
    expect(offset.east).toBeLessThan(0);
  });

  it('shrinks eastward metres as longitude lines converge toward the pole', () => {
    const atEquator = toLocalEastNorthMeters(0, 0, 0, 0.01);
    const atSixty = toLocalEastNorthMeters(60, 0, 60, 0.01);

    // cos(60 degrees) is exactly 0.5.
    expect(atSixty.east).toBeCloseTo(atEquator.east / 2, 3);
  });

  it('agrees with haversine over a map-scale separation', () => {
    const offset = toLocalEastNorthMeters(-6.2, 106.8, -6.199, 106.801);
    const projected = Math.hypot(offset.east, offset.north);
    const haversine = haversineDistanceMeters(-6.2, 106.8, -6.199, 106.801);

    expect(projected).toBeCloseTo(haversine, 1);
  });
});

describe('fromLocalEastNorthMeters', () => {
  it('returns the origin for a zero offset', () => {
    const point = fromLocalEastNorthMeters(-6.2, 106.8, { east: 0, north: 0 });
    expect(point.latitude).toBeCloseTo(-6.2, 9);
    expect(point.longitude).toBeCloseTo(106.8, 9);
  });

  it('moves north for a positive north offset only', () => {
    const point = fromLocalEastNorthMeters(-6.2, 106.8, { east: 0, north: 111 });
    expect(point.latitude).toBeGreaterThan(-6.2);
    expect(point.longitude).toBeCloseTo(106.8, 6);
  });

  it('moves east for a positive east offset only', () => {
    const point = fromLocalEastNorthMeters(-6.2, 106.8, { east: 111, north: 0 });
    expect(point.longitude).toBeGreaterThan(106.8);
    expect(point.latitude).toBeCloseTo(-6.2, 6);
  });

  it('round-trips with toLocalEastNorthMeters', () => {
    const originLat = -6.2;
    const originLon = 106.8;
    const offset = { east: 180.4, north: -63.2 };

    const point = fromLocalEastNorthMeters(originLat, originLon, offset);
    const roundTripped = toLocalEastNorthMeters(originLat, originLon, point.latitude, point.longitude);

    expect(roundTripped.east).toBeCloseTo(offset.east, 3);
    expect(roundTripped.north).toBeCloseTo(offset.north, 3);
  });
});
