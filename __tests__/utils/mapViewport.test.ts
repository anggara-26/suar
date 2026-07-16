import { projectOffsetToViewport, type Viewport } from '@/src/utils/mapViewport';

// 280 px across 140 m => exactly 2 px per metre, centre at (140, 140).
const VIEWPORT: Viewport = { size: 280, spanMeters: 140, dotInsetPx: 18 };
const CENTER = 140;
const MAX_RADIUS = CENTER - VIEWPORT.dotInsetPx;

describe('projectOffsetToViewport', () => {
  it('puts a beacon at your own position dead centre', () => {
    const dot = projectOffsetToViewport({ east: 0, north: 0 }, VIEWPORT);

    expect(dot.cx).toBe(CENTER);
    expect(dot.cy).toBe(CENTER);
    expect(dot.isOffMap).toBe(false);
  });

  it('draws north up the screen, not down', () => {
    const dot = projectOffsetToViewport({ east: 0, north: 50 }, VIEWPORT);

    expect(dot.cx).toBe(CENTER);
    expect(dot.cy).toBe(CENTER - 100); // 50 m * 2 px/m, upward
    expect(dot.outwardAngleDegrees).toBeCloseTo(0, 5);
  });

  it('draws east to the right', () => {
    const dot = projectOffsetToViewport({ east: 50, north: 0 }, VIEWPORT);

    expect(dot.cx).toBe(CENTER + 100);
    expect(dot.cy).toBe(CENTER);
    expect(dot.outwardAngleDegrees).toBeCloseTo(90, 5);
  });

  it('draws south down and west left, with the matching outward angles', () => {
    expect(projectOffsetToViewport({ east: 0, north: -50 }, VIEWPORT)).toMatchObject({
      cy: CENTER + 100,
      outwardAngleDegrees: 180,
    });
    expect(projectOffsetToViewport({ east: -50, north: 0 }, VIEWPORT)).toMatchObject({
      cx: CENTER - 100,
      outwardAngleDegrees: 270,
    });
  });

  it('scales with the span: halving the span doubles the pixel offset', () => {
    const wide = projectOffsetToViewport({ east: 10, north: 0 }, VIEWPORT);
    const zoomed = projectOffsetToViewport({ east: 10, north: 0 }, { ...VIEWPORT, spanMeters: 70 });

    expect(zoomed.cx - CENTER).toBeCloseTo((wide.cx - CENTER) * 2, 5);
  });

  it('leaves an in-reach beacon unclamped', () => {
    // 50 m => 100 px, inside the 122 px reach.
    const dot = projectOffsetToViewport({ east: 0, north: 50 }, VIEWPORT);

    expect(dot.isOffMap).toBe(false);
    expect(Math.hypot(dot.cx - CENTER, dot.cy - CENTER)).toBeCloseTo(100, 5);
  });

  it('clamps an out-of-reach beacon onto the circle, keeping its direction', () => {
    const dot = projectOffsetToViewport({ east: 0, north: 500 }, VIEWPORT);

    expect(dot.isOffMap).toBe(true);
    expect(Math.hypot(dot.cx - CENTER, dot.cy - CENTER)).toBeCloseTo(MAX_RADIUS, 5);
    expect(dot.cx).toBeCloseTo(CENTER, 5); // still due north
    expect(dot.outwardAngleDegrees).toBeCloseTo(0, 5);
  });

  it('clamps every direction to the same radius, so rotating cannot hide a dot', () => {
    // The whole reason the clamp boundary is a circle: a boundary that varied
    // with bearing would pin dots at a different radius per direction, and the
    // world rotation would sweep them outside the frame.
    const radii = [0, 30, 45, 137, 200, 300].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const dot = projectOffsetToViewport(
        { east: Math.sin(rad) * 500, north: Math.cos(rad) * 500 },
        VIEWPORT,
      );
      return Math.hypot(dot.cx - CENTER, dot.cy - CENTER);
    });

    for (const radius of radii) expect(radius).toBeCloseTo(MAX_RADIUS, 5);
  });
});
