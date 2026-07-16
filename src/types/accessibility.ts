export type AccessibilityMode = 'blind' | 'deaf' | 'standard';

export interface AccessibilityFlags {
  /** Emphasize TTS narration. */
  speak: boolean;
  /** Emphasize large/high-contrast on-screen indicators. */
  bigVisual: boolean;
  /** Multiplier applied to haptic pattern intensity, 1 = normal. */
  hapticBoost: number;
}
