import CompassHeading from 'react-native-compass-heading';

export interface HeadingSample {
  heading: number;
  accuracy: number;
}

export type HeadingListener = (sample: HeadingSample) => void;

let isWatching = false;

/**
 * Feeds the map's heading-up rotation (see components/map/MapView.tsx): the
 * world rotates so "up" is where the phone faces. Voice guidance still never
 * claims a bearing — spoken cues stay distance + hot/cold only, since a spoken
 * "turn right" needs more compass confidence than a visual rotation does.
 *
 * The 1° sensor filter is deliberately tighter than the display needs: the
 * store runs these samples through a circular EMA (utils/headingSmoothing.ts),
 * which can only smooth jitter it actually sees. A coarse filter here would
 * hand the EMA pre-quantized steps and the map would rotate in visible jumps.
 */
export function startWatchingHeading(onHeading: HeadingListener): void {
  if (isWatching) return;
  isWatching = true;
  CompassHeading.start(1, (data: HeadingSample) => onHeading(data));
}

export function stopWatchingHeading(): void {
  if (!isWatching) return;
  isWatching = false;
  CompassHeading.stop();
}
