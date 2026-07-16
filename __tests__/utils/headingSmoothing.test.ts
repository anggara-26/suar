import { smoothHeading, normalizeDegrees } from '@/src/utils/headingSmoothing';

describe('normalizeDegrees', () => {
  it('wraps negatives into 0-360', () => {
    expect(normalizeDegrees(-90)).toBe(270);
  });

  it('wraps past a full turn', () => {
    expect(normalizeDegrees(450)).toBe(90);
  });
});

describe('smoothHeading', () => {
  it('adopts the first sample outright', () => {
    expect(smoothHeading(null, 123)).toBeCloseTo(123, 5);
  });

  it('normalizes the first sample', () => {
    expect(smoothHeading(null, -90)).toBeCloseTo(270, 5);
  });

  it('moves toward the new sample without reaching it', () => {
    const smoothed = smoothHeading(0, 100);

    expect(smoothed).toBeGreaterThan(0);
    expect(smoothed).toBeLessThan(100);
  });

  it('crosses zero the short way instead of sweeping back through 180', () => {
    // Averaging degrees arithmetically would give (350 + 10) / 2 = 180 — the
    // exact opposite direction, which spins the whole map.
    const smoothed = smoothHeading(350, 10);

    // Short way from 350 toward 10 stays near the top of the circle.
    const distanceFromNorth = Math.min(smoothed, 360 - smoothed);
    expect(distanceFromNorth).toBeLessThan(15);
  });

  it('holds steady when the sample matches', () => {
    expect(smoothHeading(42, 42)).toBeCloseTo(42, 5);
  });

  it('converges on a sustained new heading', () => {
    let heading = smoothHeading(null, 0);
    for (let i = 0; i < 60; i += 1) heading = smoothHeading(heading, 90);

    expect(heading).toBeCloseTo(90, 1);
  });

  it('stays finite for opposite headings', () => {
    // The unequal weighting keeps the blended vector off the origin, where
    // atan2 would be meaningless.
    expect(Number.isFinite(smoothHeading(0, 180))).toBe(true);
  });
});
