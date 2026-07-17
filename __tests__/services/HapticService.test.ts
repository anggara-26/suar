/**
 * `native`/fallback selection happens at module load time (see HapticService),
 * so each case here mocks `react-native` fresh and re-requires the module
 * rather than importing it once at the top of the file.
 */
function loadHapticService(rnMock: Record<string, unknown>) {
  jest.resetModules();
  jest.doMock('react-native', () => rnMock);
  return require('@/src/services/haptics/HapticService') as typeof import('@/src/services/haptics/HapticService');
}

afterEach(() => {
  jest.dontMock('react-native');
});

describe('HapticService', () => {
  it('vibrates through the native SuarHaptics module on Android, looping the pattern from the start', () => {
    const vibratePattern = jest.fn();
    const cancel = jest.fn();
    const { playBucketPattern } = loadHapticService({
      Platform: { OS: 'android' },
      NativeModules: { SuarHaptics: { vibratePattern, cancel } },
      Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
    });

    playBucketPattern('near');

    expect(vibratePattern).toHaveBeenCalledWith([0, 150, 150, 150], 0);
  });

  it("cancels through the native module too, so a bucket change doesn't leave two patterns overlapping", () => {
    const vibratePattern = jest.fn();
    const cancel = jest.fn();
    const { playBucketPattern, stopHaptics } = loadHapticService({
      Platform: { OS: 'android' },
      NativeModules: { SuarHaptics: { vibratePattern, cancel } },
      Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
    });

    playBucketPattern('near');
    stopHaptics();

    // Once for the bucket switch's own cancel-before-vibrate, once for stopHaptics.
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('falls back to RN Vibration when the native module is unavailable (e.g. a JS-only reload before a native rebuild)', () => {
    const vibrate = jest.fn();
    const cancel = jest.fn();
    const { playBucketPattern, stopHaptics } = loadHapticService({
      Platform: { OS: 'android' },
      NativeModules: {},
      Vibration: { vibrate, cancel },
    });

    playBucketPattern('far');
    expect(vibrate).toHaveBeenCalledWith([0, 300, 2000], true);

    stopHaptics();
    expect(cancel).toHaveBeenCalled();
  });

  it('falls back to RN Vibration on iOS, since the ringer-mode bypass is Android-only', () => {
    const vibrate = jest.fn();
    const { playBucketPattern } = loadHapticService({
      Platform: { OS: 'ios' },
      NativeModules: { SuarHaptics: { vibratePattern: jest.fn(), cancel: jest.fn() } },
      Vibration: { vibrate, cancel: jest.fn() },
    });

    playBucketPattern('medium');

    expect(vibrate).toHaveBeenCalledWith([0, 200, 600], true);
  });

  it('does not restart the pattern for the same bucket back-to-back', () => {
    const vibratePattern = jest.fn();
    const { playBucketPattern } = loadHapticService({
      Platform: { OS: 'android' },
      NativeModules: { SuarHaptics: { vibratePattern, cancel: jest.fn() } },
      Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
    });

    playBucketPattern('medium');
    playBucketPattern('medium');

    expect(vibratePattern).toHaveBeenCalledTimes(1);
  });
});
