import { Pressable, Text } from 'react-native';
import type { HazardType, MitigationArticle } from '@/src/types/education';

const HAZARD_EMOJI: Record<HazardType, string> = {
  earthquake: '🏚️',
  tsunami: '🌊',
  flood: '🌊',
  volcano: '🌋',
  landslide: '⛰️',
  general: 'ℹ️',
};

interface MitigationCardProps {
  article: MitigationArticle;
  width: number;
  onPress: () => void;
}

/**
 * Deliberately plain: padding only, no border, no shadow. This is background
 * reading, not a live/actionable beacon — BeaconRow's bordered-card treatment
 * is reserved for things the app is actively tracking right now.
 */
export function MitigationCard({ article, width, onPress }: MitigationCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.excerpt}. Tap to read the full article.`}
      style={{ width }}
      className="mr-3 p-3">
      <Text className="text-base">
        {HAZARD_EMOJI[article.hazardType]} <Text className="font-semibold text-typography-900">{article.title}</Text>
      </Text>
      <Text className="mt-1 text-sm text-typography-600" numberOfLines={3}>
        {article.excerpt}
      </Text>
    </Pressable>
  );
}
