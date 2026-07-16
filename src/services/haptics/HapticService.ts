import { Vibration } from 'react-native';
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

let activeBucket: RssiBucket | null = null;

export function playBucketPattern(bucket: RssiBucket): void {
  if (activeBucket === bucket) return;
  Vibration.cancel();
  Vibration.vibrate(PATTERNS[bucket], true);
  activeBucket = bucket;
}

export function stopHaptics(): void {
  Vibration.cancel();
  activeBucket = null;
}
