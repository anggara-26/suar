import { useSettingsStore } from '@/src/state/settingsStore';
import type { AccessibilityFlags, AccessibilityMode } from '@/src/types/accessibility';

/**
 * Behavioral flags, not a raw mode string — components branch on capability
 * ("do I speak?", "am I big?"), not on the mode taxonomy. Adding a 4th mode
 * later only means adding one more row here, not touching every consumer.
 */
const FLAGS_BY_MODE: Record<AccessibilityMode, AccessibilityFlags> = {
  // Maps/visual are useless to a blind user — voice + haptic carry everything.
  blind: { speak: true, bigVisual: false, hapticBoost: 1.5 },
  // A Deaf user loses the audio channel entirely, so visual + haptic must do more.
  deaf: { speak: false, bigVisual: true, hapticBoost: 1.5 },
  standard: { speak: true, bigVisual: true, hapticBoost: 1 },
};

export function useAccessibilityMode(): AccessibilityFlags & { mode: AccessibilityMode } {
  const mode = useSettingsStore((state) => state.accessibilityMode);
  return { ...FLAGS_BY_MODE[mode], mode };
}
