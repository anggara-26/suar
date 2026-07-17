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
  /** Map width in pixels. */
  width: number;
  /** Map height in pixels. */
  height: number;
  /** How many metres the map spans across its shorter dimension. */
  spanMeters: number;
  /** Keeps a dot's glyph clear of the frame. */
  dotInsetPx: number;
}

/**
 * Projects a north-up world offset onto the map's pixel grid, north-up.
 *
 * Deliberately heading-free: the view rotates the whole world with one
 * transform, so baking rotation in here would recompute every dot on every
 * compass sample for no gain.
 *
 * The map fills a plain rectangle now (no circular frame), so scale is set by
 * the *shorter* side — the longer side then simply shows more world, which is
 * how a filled map is supposed to behave, rather than wasting the extra reach
 * by force-fitting an inscribed circle into it.
 *
 * Out-of-reach beacons clamp to the rectangle itself: the offset is scaled
 * down just enough that neither axis exceeds its half of the box, so a dot
 * pinned directly ahead stops at the top edge and one off to the side can
 * still ride out to the left/right edge — whichever wall it reaches first.
 * That clamp uses the full rectangle (not a circle inscribed in it), which is
 * the point of "just fill": nothing in the corners goes to waste.
 */
export function projectOffsetToViewport(offset: LocalOffsetMeters, viewport: Viewport): ViewportDot {
  const { width, height, spanMeters, dotInsetPx } = viewport;
  const centerX = width / 2;
  const centerY = height / 2;
  const pxPerMetre = Math.min(width, height) / spanMeters;

  const dx = offset.east * pxPerMetre;
  const dy = -offset.north * pxPerMetre;

  const maxX = centerX - dotInsetPx;
  const maxY = centerY - dotInsetPx;

  // Whichever axis would overshoot first sets the scale; dx or dy at exactly 0
  // divides to Infinity (not NaN, since the numerator is positive), which
  // Math.min correctly ignores in favour of the other axis's real limit.
  const scale = Math.min(1, maxX / Math.abs(dx), maxY / Math.abs(dy));
  const isOffMap = scale < 1;

  return {
    cx: centerX + dx * scale,
    cy: centerY + dy * scale,
    isOffMap,
    // atan2(dx, -dy) measures clockwise from up, matching SVG's rotate().
    outwardAngleDegrees: normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI),
  };
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
