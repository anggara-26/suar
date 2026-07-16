import type { LocalOffsetMeters } from '@/src/utils/geo';

export interface ViewportDot {
  cx: number;
  cy: number;
  /** True when the beacon is beyond the map's reach and has been pulled inward. */
  isOffMap: boolean;
  /** Direction away from centre, in screen degrees clockwise from up. */
  outwardAngleDegrees: number;
}

export interface Viewport {
  /** Width and height of the square, in pixels. */
  size: number;
  /** How many metres the square spans edge to edge. */
  spanMeters: number;
  /** Keeps a dot's glyph clear of the frame. */
  dotInsetPx: number;
}

/**
 * Projects a north-up world offset onto the square's pixel grid, north-up.
 *
 * Deliberately heading-free: the view rotates the whole world with one
 * transform, so baking rotation in here would recompute every dot on every
 * compass sample for no gain.
 *
 * Out-of-reach beacons clamp to the inscribed circle rather than the square's
 * edge. A circle is rotation-invariant, so a clamped dot stays put and stays
 * visible as the world turns, and nothing pops in and out of the corners —
 * the square is the frame, the circle is the reach.
 */
export function projectOffsetToViewport(offset: LocalOffsetMeters, viewport: Viewport): ViewportDot {
  const { size, spanMeters, dotInsetPx } = viewport;
  const center = size / 2;
  const pxPerMetre = size / spanMeters;

  const dx = offset.east * pxPerMetre;
  const dy = -offset.north * pxPerMetre;

  const radiusPx = Math.hypot(dx, dy);
  const maxRadiusPx = center - dotInsetPx;
  const isOffMap = radiusPx > maxRadiusPx;
  const scale = isOffMap ? maxRadiusPx / radiusPx : 1;

  return {
    cx: center + dx * scale,
    cy: center + dy * scale,
    isOffMap,
    // atan2(dx, -dy) measures clockwise from up, matching SVG's rotate().
    outwardAngleDegrees: normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI),
  };
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
