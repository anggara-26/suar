import {
  smoothRssi,
  rssiToBucket,
  applyHysteresis,
  createBucketTransitionState,
} from '@/src/utils/rssiSmoothing';

describe('smoothRssi', () => {
  it('seeds directly from the first sample', () => {
    expect(smoothRssi(null, -60)).toBe(-60);
  });

  it('applies exponential smoothing toward new samples', () => {
    const smoothed = smoothRssi(-60, -80);
    // Should move toward -80 but not jump all the way there.
    expect(smoothed).toBeLessThan(-60);
    expect(smoothed).toBeGreaterThan(-80);
  });
});

describe('rssiToBucket', () => {
  it.each([
    [-40, 'very-near'],
    [-60, 'near'],
    [-80, 'medium'],
    [-95, 'far'],
  ] as const)('maps %i dBm to %s', (rssi, expected) => {
    expect(rssiToBucket(rssi)).toBe(expected);
  });
});

describe('applyHysteresis', () => {
  it('keeps the current bucket for a single outlier sample', () => {
    let state = createBucketTransitionState('medium');
    state = applyHysteresis(state, 'near');
    expect(state.currentBucket).toBe('medium');
  });

  it('only switches buckets after enough consecutive agreeing samples', () => {
    let state = createBucketTransitionState('medium');
    state = applyHysteresis(state, 'near');
    state = applyHysteresis(state, 'near');
    expect(state.currentBucket).toBe('medium'); // still pending
    state = applyHysteresis(state, 'near');
    expect(state.currentBucket).toBe('near'); // third consecutive sample flips it
  });

  it('resets the pending counter when samples disagree', () => {
    let state = createBucketTransitionState('medium');
    state = applyHysteresis(state, 'near');
    state = applyHysteresis(state, 'far'); // different candidate resets pending
    expect(state.pendingBucket).toBe('far');
    expect(state.pendingCount).toBe(1);
    expect(state.currentBucket).toBe('medium');
  });

  it('is a no-op once already on the candidate bucket', () => {
    let state = createBucketTransitionState('near');
    state = applyHysteresis(state, 'near');
    expect(state).toEqual({ currentBucket: 'near', pendingBucket: null, pendingCount: 0 });
  });
});
