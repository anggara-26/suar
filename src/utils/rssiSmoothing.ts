import type { RssiBucket } from '@/src/types/beacon';

const EMA_ALPHA = 0.25;

/** Exponential moving average — cheaper than a full window and stable enough for haptic feedback. */
export function smoothRssi(previousSmoothed: number | null, newSample: number): number {
  if (previousSmoothed === null) return newSample;
  return EMA_ALPHA * newSample + (1 - EMA_ALPHA) * previousSmoothed;
}

const BUCKET_THRESHOLDS: { bucket: RssiBucket; min: number }[] = [
  { bucket: 'very-near', min: -55 },
  { bucket: 'near', min: -70 },
  { bucket: 'medium', min: -85 },
  { bucket: 'far', min: -Infinity },
];

/** Starting-point thresholds — calibrate against real demo hardware before the event. */
export function rssiToBucket(smoothedRssi: number): RssiBucket {
  for (const { bucket, min } of BUCKET_THRESHOLDS) {
    if (smoothedRssi >= min) return bucket;
  }
  return 'far';
}

const HYSTERESIS_SAMPLE_COUNT = 3;

export interface BucketTransitionState {
  currentBucket: RssiBucket;
  pendingBucket: RssiBucket | null;
  pendingCount: number;
}

export function createBucketTransitionState(initialBucket: RssiBucket): BucketTransitionState {
  return { currentBucket: initialBucket, pendingBucket: null, pendingCount: 0 };
}

/**
 * A beacon sitting on a bucket boundary would otherwise flicker between two
 * haptic patterns every sample — exactly what the PRD warns looks buggy in a
 * demo. A candidate bucket only takes effect after HYSTERESIS_SAMPLE_COUNT
 * consecutive samples agree on it.
 */
export function applyHysteresis(
  state: BucketTransitionState,
  candidateBucket: RssiBucket,
): BucketTransitionState {
  if (candidateBucket === state.currentBucket) {
    return { currentBucket: state.currentBucket, pendingBucket: null, pendingCount: 0 };
  }

  if (state.pendingBucket === candidateBucket) {
    const pendingCount = state.pendingCount + 1;
    if (pendingCount >= HYSTERESIS_SAMPLE_COUNT) {
      return { currentBucket: candidateBucket, pendingBucket: null, pendingCount: 0 };
    }
    return { currentBucket: state.currentBucket, pendingBucket: candidateBucket, pendingCount };
  }

  return { currentBucket: state.currentBucket, pendingBucket: candidateBucket, pendingCount: 1 };
}
