import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/src/state/settingsStore';
import { useAccessibilityMode } from '@/src/hooks/useAccessibilityMode';
import { speak } from '@/src/services/tts/TtsService';
import type { AccessibilityMode } from '@/src/types/accessibility';

const MODE_ANNOUNCEMENT: Record<AccessibilityMode, string> = {
  blind: 'Blind mode. Voice and vibration will guide you.',
  deaf: 'Deaf mode. Visual and vibration will guide you.',
  standard: 'Standard mode.',
};

/**
 * Invisible — announces accessibility-relevant state changes over TTS when
 * the current mode has `speak` enabled. Distinct from useVoiceGuidance
 * (Phase 4), which narrates ongoing distance/direction rather than one-off
 * state transitions.
 */
export function AccessibleAnnouncer() {
  const { speak: speakEnabled, mode } = useAccessibilityMode();
  const isAssemblyPoint = useSettingsStore((state) => state.isAssemblyPoint);
  const isFirstModeRender = useRef(true);
  const previousAssemblyPoint = useRef(isAssemblyPoint);

  useEffect(() => {
    if (isFirstModeRender.current) {
      isFirstModeRender.current = false;
      return;
    }
    if (speakEnabled) {
      speak(MODE_ANNOUNCEMENT[mode], { force: true });
    }
  }, [mode, speakEnabled]);

  useEffect(() => {
    if (previousAssemblyPoint.current === isAssemblyPoint) return;
    previousAssemblyPoint.current = isAssemblyPoint;
    if (speakEnabled) {
      speak(
        isAssemblyPoint
          ? 'This phone is now an assembly point beacon.'
          : 'Assembly point turned off.',
        { force: true },
      );
    }
  }, [isAssemblyPoint, speakEnabled]);

  return null;
}
