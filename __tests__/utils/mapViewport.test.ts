import { projectOffsetToViewport, type Viewport } from '@/src/utils/mapViewport';

// 280x280 px across 140 m => exactly 2 px per metre, centre at (140, 140).
// Square on purpose for these cases: it isolates "does the projection/clamp
// math work" from "does it handle width != height", which gets its own tests.
const VIEWPORT: Viewport = { width: 280, height: 280, spanMeters: 140, dotInsetPx: 18 };
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

  it('clamps a due-north beacon to the top edge, keeping its direction', () => {
    const dot = projectOffsetToViewport({ east: 0, north: 500 }, VIEWPORT);

    expect(dot.isOffMap).toBe(true);
    expect(dot.cy).toBeCloseTo(CENTER - MAX_RADIUS, 5);
    expect(dot.cx).toBeCloseTo(CENTER, 5); // still due north
    expect(dot.outwardAngleDegrees).toBeCloseTo(0, 5);
  });

  it('clamps to the box, not an inscribed circle — corners reach farther than the sides', () => {
    // Box-clamping is the whole point of "just fill": a circle clamp would
    // waste the corners, but a box clamp lets a diagonal beacon ride out to
    // the box's corner, which sits sqrt(2) times farther out than the
    // cardinal directions on a square. Equal-radius-at-every-angle would mean
    // the corners are being wasted again.
    const radiusAt = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      const dot = projectOffsetToViewport(
        { east: Math.sin(rad) * 500, north: Math.cos(rad) * 500 },
        VIEWPORT,
      );
      return Math.hypot(dot.cx - CENTER, dot.cy - CENTER);
    };

    for (const cardinal of [0, 90, 180, 270]) {
      expect(radiusAt(cardinal)).toBeCloseTo(MAX_RADIUS, 5);
    }
    for (const diagonal of [45, 135, 225, 315]) {
      expect(radiusAt(diagonal)).toBeCloseTo(MAX_RADIUS * Math.SQRT2, 5);
    }
  });
});

describe('projectOffsetToViewport on a non-square (filled) viewport', () => {
  // Wider than tall, e.g. a map filling the space above a bottom sheet: the
  // whole point of clamping to the rectangle rather than an inscribed circle
  // is that the wider axis should reach further than the shorter one.
  const WIDE: Viewport = { width: 400, height: 200, spanMeters: 100, dotInsetPx: 0 };
  // min(400, 200) / 100 = 2 px/m.

  it('reaches further to the side than up/down, because the box is wider than it is tall', () => {
    const east = projectOffsetToViewport({ east: 1000, north: 0 }, WIDE);
    const north = projectOffsetToViewport({ east: 0, north: 1000 }, WIDE);

    expect(east.cx).toBeCloseTo(400, 5); // clamped to the right edge
    expect(north.cy).toBeCloseTo(0, 5); // clamped to the top edge

    // Distance reached sideways (half the width) exceeds distance reached
    // vertically (half the height) — a circle clamp would have made these equal.
    expect(Math.abs(east.cx - 200)).toBeGreaterThan(Math.abs(north.cy - 100));
  });

  it('clamps a diagonal offset to whichever wall it reaches first, preserving direction', () => {
    // Far enough on both axes that the shorter (vertical) wall binds first.
    const dot = projectOffsetToViewport({ east: 1000, north: 1000 }, WIDE);

    expect(dot.cy).toBeCloseTo(0, 5); // hits the top edge
    expect(dot.cx).toBeLessThan(400); // east axis stops short of the side edge
    expect(dot.outwardAngleDegrees).toBeCloseTo(45, 5); // direction preserved
  });

  it('never off-maps a beacon that fits inside the rectangle in both axes', () => {
    // 50m east * 2px/m = 100px (< half-width 200); 30m north * 2px/m = 60px (< half-height 100).
    const dot = projectOffsetToViewport({ east: 50, north: 30 }, WIDE);

    expect(dot.isOffMap).toBe(false);
    expect(dot.cx).toBeCloseTo(300, 5);
    expect(dot.cy).toBeCloseTo(40, 5);
  });
});
