export interface AccessibilityFlags {
  /** TTS narration channel. */
  speak: boolean;
  /** Vibration feedback channel. */
  haptics: boolean;
  /** Large/high-contrast on-screen indicators — always on (visual channel has no off switch). */
  bigVisual: boolean;
}
