import { useSettingsStore } from '@/src/state/settingsStore';
import type { AccessibilityFlags } from '@/src/types/accessibility';

/**
 * Behavioral flags — components branch on capability ("do I speak?"), not on
 * a user-category taxonomy. Every channel defaults on; settings only disable.
 * bigVisual is constant: the visual channel (radar, emphasized text) is the
 * one channel that never has an off switch.
 */
export function useAccessibilityMode(): AccessibilityFlags {
  const speak = useSettingsStore((state) => state.voiceEnabled);
  const haptics = useSettingsStore((state) => state.hapticsEnabled);
  return { speak, haptics, bigVisual: true };
}
