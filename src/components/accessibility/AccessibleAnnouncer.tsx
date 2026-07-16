import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/src/state/settingsStore';
import { speak, stopSpeaking } from '@/src/services/tts/TtsService';

/**
 * Invisible — announces accessibility-relevant state changes over TTS.
 * Distinct from useVoiceGuidance (Phase 4), which narrates ongoing
 * distance/direction rather than one-off state transitions.
 */
export function AccessibleAnnouncer() {
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const isAssemblyPoint = useSettingsStore((state) => state.isAssemblyPoint);
  const previousVoice = useRef(voiceEnabled);
  const previousHaptics = useRef(hapticsEnabled);
  const previousAssemblyPoint = useRef(isAssemblyPoint);

  useEffect(() => {
    if (previousVoice.current === voiceEnabled) return;
    previousVoice.current = voiceEnabled;
    if (voiceEnabled) {
      speak('Voice guidance on.', { force: true });
    } else {
      // Cut off any in-flight utterance immediately — "off" must feel instant.
      stopSpeaking();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (previousHaptics.current === hapticsEnabled) return;
    previousHaptics.current = hapticsEnabled;
    if (voiceEnabled) {
      speak(hapticsEnabled ? 'Vibration on.' : 'Vibration off.', { force: true });
    }
  }, [hapticsEnabled, voiceEnabled]);

  useEffect(() => {
    if (previousAssemblyPoint.current === isAssemblyPoint) return;
    previousAssemblyPoint.current = isAssemblyPoint;
    if (voiceEnabled) {
      speak(
        isAssemblyPoint
          ? 'This phone is now an assembly point beacon.'
          : 'Assembly point turned off.',
        { force: true },
      );
    }
  }, [isAssemblyPoint, voiceEnabled]);

  return null;
}
