import { useRef } from 'react';
import { Pressable } from 'react-native';
import type { DemoPhase } from '@/src/hooks/useDemoScenario';

const TAPS_REQUIRED = 5;
const TAP_RESET_MS = 2500;

interface HiddenDemoTriggerProps {
  phase: DemoPhase;
  start: () => void;
  cancel: () => void;
}

/**
 * Invisible, absolute top-right — same pattern as Android's hidden
 * developer-options gesture (tap N times, too slow and it resets). Five taps
 * while idle starts the scripted demo; five taps while it's already running
 * (countdown or mid-sequence) cancels it instead, so a bad take can be
 * aborted rather than recorded through. Dev-only: only ever mounted by
 * RadarScreen inside an `if (__DEV__)` check, so this doesn't exist at all in
 * a release build.
 */
export function HiddenDemoTrigger({ phase, start, cancel }: HiddenDemoTriggerProps) {
  const tapCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePress() {
    tapCountRef.current += 1;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TAP_RESET_MS);

    if (tapCountRef.current >= TAPS_REQUIRED) {
      tapCountRef.current = 0;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (phase === 'idle') {
        start();
      } else {
        cancel();
      }
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      // No accessibilityRole/label — a hidden gesture shouldn't announce
      // itself to a screen reader either; it isn't a real feature of the app.
      className="absolute right-0 top-0 h-14 w-14 bg-transparent"
    />
  );
}
