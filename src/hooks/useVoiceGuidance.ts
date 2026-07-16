import { useEffect, useRef } from 'react';
import { useFocusedBeacon } from '@/src/hooks/useFocusedBeacon';
import { useAccessibilityMode } from '@/src/hooks/useAccessibilityMode';
import { useBeaconStore } from '@/src/state/beaconStore';
import { placeBeaconOnRadar } from '@/src/utils/radarPlacement';
import { speak } from '@/src/services/tts/TtsService';
import { BeaconType } from '@/src/types/beacon';

const ANNOUNCE_INTERVAL_MS = 6000;
/** Minimum change in normalized radar distance before calling out a warmer/colder trend. */
const TREND_EPSILON = 0.03;

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
  const previousNormalizedDistance = useRef<number | null>(null);

  useEffect(() => {
    previousNormalizedDistance.current = null;
    if (!speakEnabled || !focusedDeviceId) return;

    function announceOnce() {
      const state = useBeaconStore.getState();
      const beacon = state.discoveredBeacons[focusedDeviceId!];
      if (!beacon) return;

      const point = placeBeaconOnRadar(state.ownLocation, beacon);
      const normalizedDistance = Math.hypot(point.x, point.y);

      let trendPhrase = '';
      if (previousNormalizedDistance.current !== null) {
        const delta = normalizedDistance - previousNormalizedDistance.current;
        if (delta < -TREND_EPSILON) trendPhrase = ', getting warmer';
        else if (delta > TREND_EPSILON) trendPhrase = ', getting colder';
      }
      previousNormalizedDistance.current = normalizedDistance;

      const kind = beacon.beaconType === BeaconType.Assembly ? 'Assembly point' : 'Person';
      speak(`${kind} ${point.distanceLabel}${trendPhrase}`);
    }

    announceOnce();
    const interval = setInterval(announceOnce, ANNOUNCE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [speakEnabled, focusedDeviceId]);
}
