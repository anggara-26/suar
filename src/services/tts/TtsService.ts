import Tts from 'react-native-tts';

let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Tts.getInitStatus()
      .then(() => undefined)
      .catch(async (error: { code?: string }) => {
        // Android-only: no TTS engine installed yet — prompt the user to get one.
        if (error?.code === 'no_engine') {
          await Tts.requestInstallEngine().catch(() => {});
        }
      });
  }
  return initPromise;
}

let lastSpokenAt = 0;
const MIN_SPEAK_INTERVAL_MS = 1500;

/**
 * Speaks immediately, dropping calls that arrive faster than a human can
 * absorb them (e.g. a tight RSSI update loop) unless `force` is set — used for
 * one-off state-change announcements (mode switched, assembly point toggled)
 * that should never be silently dropped.
 */
export async function speak(utterance: string, options?: { force?: boolean }): Promise<void> {
  await ensureInitialized();

  const now = Date.now();
  if (!options?.force && now - lastSpokenAt < MIN_SPEAK_INTERVAL_MS) {
    return;
  }
  lastSpokenAt = now;

  Tts.stop();
  Tts.speak(utterance);
}

export function stopSpeaking(): void {
  Tts.stop();
}
