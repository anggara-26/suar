import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { HazardType, MitigationArticle } from '@/src/types/education';

const HAZARD_EMOJI: Record<HazardType, string> = {
  earthquake: '🏚️',
  tsunami: '🌊',
  flood: '🌊',
  volcano: '🌋',
  landslide: '⛰️',
  general: 'ℹ️',
};

interface MitigationArticleModalProps {
  article: MitigationArticle | null;
  onClose: () => void;
}

/**
 * Same structure as AssemblyToggleSheet — Modal + backdrop press-to-close +
 * an inner Pressable that swallows the tap so the sheet itself is safe to
 * touch — kept consistent so the app has one sheet language, not two.
 */
export function MitigationArticleModal({ article, onClose }: MitigationArticleModalProps) {
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={article !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end bg-black/40"
        onPress={onClose}
        accessibilityLabel="Close article"
        accessibilityRole="button">
        <Pressable
          className="rounded-t-3xl bg-background-0 px-5 pb-8 pt-4"
          style={{ maxHeight: screenHeight * 0.7 }}
          onPress={(event) => event.stopPropagation()}>
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-outline-200" />

          {article ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-lg font-bold text-typography-900">
                {HAZARD_EMOJI[article.hazardType]} {article.title}
              </Text>
              <Text className="mt-3 text-base leading-6 text-typography-700">{article.body}</Text>
            </ScrollView>
          ) : null}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="mt-4 self-center rounded-full border border-outline-200 px-5 py-2">
            <Text className="text-sm font-medium text-typography-900">Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
