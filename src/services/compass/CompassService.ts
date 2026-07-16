import CompassHeading from 'react-native-compass-heading';

export interface HeadingSample {
  heading: number;
  accuracy: number;
}

export type HeadingListener = (sample: HeadingSample) => void;

let isWatching = false;

/**
 * Kept minimal and unused by the app's default flow: voice guidance ships
 * distance + hot/cold only in v1 (plan decision #4) and never claims a
 * bearing, which is the only thing a compass would be for here. This wrapper
 * exists so bearing can be added later as an explicit stretch without a new
 * native dependency — starting it isn't wired into any active screen yet.
 */
export function startWatchingHeading(onHeading: HeadingListener): void {
  if (isWatching) return;
  isWatching = true;
  CompassHeading.start(3, (data: HeadingSample) => onHeading(data));
}

export function stopWatchingHeading(): void {
  if (!isWatching) return;
  isWatching = false;
  CompassHeading.stop();
}
