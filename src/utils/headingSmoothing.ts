const EMA_ALPHA = 0.2;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Exponential moving average over the heading, done on the unit circle.
 *
 * Averaging the degree values directly breaks at the wrap point: blending 350°
 * with 10° arithmetically gives 180°, the exact opposite direction, which on a
 * heading-up map spins the whole world. Averaging the direction vectors and
 * reading the angle back off the result has no wrap to get wrong. Raw
 * magnetometer output is jittery enough that rotating a full map on it is
 * unpleasant to look at.
 *
 * The blend can't land on the origin (where atan2 would be meaningless): the
 * two vectors are unit length and unequally weighted, so the result is never
 * shorter than |1 - 2 * EMA_ALPHA|.
 */
export function smoothHeading(previousSmoothed: number | null, newSample: number): number {
  if (previousSmoothed === null) return normalizeDegrees(newSample);

  const previousRad = toRadians(previousSmoothed);
  const sampleRad = toRadians(newSample);

  const x = EMA_ALPHA * Math.cos(sampleRad) + (1 - EMA_ALPHA) * Math.cos(previousRad);
  const y = EMA_ALPHA * Math.sin(sampleRad) + (1 - EMA_ALPHA) * Math.sin(previousRad);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}
