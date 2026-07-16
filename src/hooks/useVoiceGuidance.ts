import { useEffect, useRef } from 'react';
import { useFocusedBeacon } from '@/src/hooks/useFocusedBeacon';
import { useAccessibilityMode } from '@/src/hooks/useAccessibilityMode';
import { useBeaconStore } from '@/src/state/beaconStore';
import { placeBeaconOnMap } from '@/src/utils/mapPlacement';
import { speak } from '@/src/services/tts/TtsService';
import { BeaconType } from '@/src/types/beacon';

const ANNOUNCE_INTERVAL_MS = 6000;

/**
 * A trend cue is only honest against a like-for-like previous reading, so the
 * source travels with the value. GPS metres and RSSI dBm move on different
 * scales and in opposite directions, and a beacon flips between them whenever
 * a fix arrives, drops, or crosses the bearing gate — comparing across that
 * switch invents a "warmer" that never happened.
 */
type ProximityReading =
  | { source: 'gps'; meters: number }
  | { source: 'rssi'; dbm: number };

/** Metres of GPS movement before it's worth calling out; below this it's fix noise. */
const GPS_TREND_EPSILON_METERS = 2;
/** dBm of change before it's worth calling out; below this it's radio noise. */
const RSSI_TREND_EPSILON_DBM = 2;

function trendPhraseFor(previous: ProximityReading | null, current: ProximityReading): string {
  if (previous === null || previous.source !== current.source) return '';

  if (previous.source === 'gps' && current.source === 'gps') {
    const delta = current.meters - previous.meters;
    if (delta < -GPS_TREND_EPSILON_METERS) return ', getting warmer';
    if (delta > GPS_TREND_EPSILON_METERS) return ', getting colder';
    return '';
  }

  if (previous.source === 'rssi' && current.source === 'rssi') {
    // Stronger signal (less negative) means closer.
    const delta = current.dbm - previous.dbm;
    if (delta > RSSI_TREND_EPSILON_DBM) return ', getting warmer';
    if (delta < -RSSI_TREND_EPSILON_DBM) return ', getting colder';
  }

  return '';
}

/**
 * Speaks distance to the focused beacon on an interval, plus a hot/cold trend
 * cue. Never attempts a bearing ("turn right") — that needs compass+GPS both
 * solid, which this app doesn't ship for v1 (plan decision #4). Distance-only
 * claims are always honest regardless of GPS/compass availability.
 */
export function useVoiceGuidance(): void {
  const { speak: speakEnabled } = useAccessibilityMode();
  const focused = useFocusedBeacon();
  const focusedDeviceId = focused?.deviceId ?? null;
  const previousReading = useRef<ProximityReading | null>(null);

  useEffect(() => {
    previousReading.current = null;
    if (!speakEnabled || !focusedDeviceId) return;

    function announceOnce() {
      const state = useBeaconStore.getState();
      const beacon = state.discoveredBeacons[focusedDeviceId!];
      if (!beacon) return;

      const placement = placeBeaconOnMap(state.ownLocation, beacon);
      const reading: ProximityReading =
        placement.distanceMeters !== null
          ? { source: 'gps', meters: placement.distanceMeters }
          : { source: 'rssi', dbm: beacon.smoothedRssi };

      const trendPhrase = trendPhraseFor(previousReading.current, reading);
      previousReading.current = reading;

      const kind = beacon.beaconType === BeaconType.Assembly ? 'Assembly point' : 'Person';
      speak(`${kind} ${placement.distanceLabel}${trendPhrase}`);
    }

    announceOnce();
    const interval = setInterval(announceOnce, ANNOUNCE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [speakEnabled, focusedDeviceId]);
}
