import { haversineDistanceMeters, bearingDegrees } from '@/src/utils/geo';

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
