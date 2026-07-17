import { NativeModules, Platform, Vibration } from 'react-native';
import type { RssiBucket } from '@/src/types/beacon';

/**
 * Distance-only patterns — never implies direction (see PRD §7: BLE/RSSI gives
 * distance, not bearing). Coarse buckets read more easily than a smooth ramp,
 * which matters most for a blind user relying on pattern changes.
 */
const PATTERNS: Record<RssiBucket, number[]> = {
  'very-near': [0, 100, 50, 100, 50, 100],
  near: [0, 150, 150, 150],
  medium: [0, 200, 600],
  far: [0, 300, 2000],
};

interface SuarHapticsNativeModule {
  vibratePattern(pattern: number[], repeatIndex: number): void;
  cancel(): void;
}

/**
 * RN's built-in `Vibration` always fires under Android's default vibration
 * usage, which the OS scales to zero amplitude whenever the ringer is in
 * Silent/DND — silencing this identically to every other app's vibration
 * (confirmed live via `dumpsys vibrator_manager`: even the system UI's own
 * touch haptics show `scale: 0.00` in that state). Proximity haptics is a
 * safety-relevant accessibility channel (F3), so on Android it goes through
 * SuarHaptics instead, which vibrates under USAGE_ALARM — one of the few
 * usages Android does not silence for ringer state. No iOS equivalent here:
 * this device-side bug was only observed/verified on Android, and iOS's
 * mute-switch/haptics interaction is a different mechanism entirely.
 */
const native: SuarHapticsNativeModule | undefined =
  Platform.OS === 'android' ? NativeModules.SuarHaptics : undefined;

let activeBucket: RssiBucket | null = null;

function startVibrating(pattern: number[]): void {
  if (native) {
    native.vibratePattern(pattern, 0); // 0: loop back to the start of the pattern.
  } else {
    Vibration.vibrate(pattern, true);
  }
}

function cancelVibrating(): void {
  if (native) {
    native.cancel();
  } else {
    Vibration.cancel();
  }
}

export function playBucketPattern(bucket: RssiBucket): void {
  if (activeBucket === bucket) return;
  cancelVibrating();
  startVibrating(PATTERNS[bucket]);
  activeBucket = bucket;
}

export function stopHaptics(): void {
  cancelVibrating();
  activeBucket = null;
}
