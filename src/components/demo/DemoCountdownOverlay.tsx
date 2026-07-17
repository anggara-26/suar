import { Text, View } from 'react-native';
import type { DemoPhase } from '@/src/hooks/useDemoScenario';

interface DemoCountdownOverlayProps {
  phase: DemoPhase;
  countdownValue: number;
}

/**
 * The only part of the demo scenario that visually covers the real app — a
 * cue for whoever's recording to start rolling. It disappears the instant the
 * scripted steps begin, so everything after this (the settings sheet, the
 * map, the beacon list) is the genuine UI reacting, nothing drawn over it.
 */
export function DemoCountdownOverlay({ phase, countdownValue }: DemoCountdownOverlayProps) {
  if (phase !== 'countdown') return null;

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-black/70"
      pointerEvents="none">
      <Text className="text-8xl font-bold text-white">{countdownValue}</Text>
    </View>
  );
}
