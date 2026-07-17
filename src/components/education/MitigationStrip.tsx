import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useMitigationArticles } from '@/src/hooks/useMitigationArticles';
import { MitigationCard } from '@/src/components/education/MitigationCard';
import { MitigationArticleModal } from '@/src/components/education/MitigationArticleModal';
import { advanceCarousel, settleScrollPosition } from '@/src/utils/autoScrollCarousel';
import type { MitigationArticle } from '@/src/types/education';

/** Matches the fixed panel's own horizontal padding (RadarScreen's `px-4`) and the card's `mr-3` gap. */
const SHEET_PADDING_PX = 16;
const CARD_GAP_PX = 12;
/** Dwell time on each pair of cards before the carousel slides to the next. */
const AUTO_ADVANCE_INTERVAL_MS = 3400;
/** How long after a touch ends before the carousel starts advancing again. */
const RESUME_AFTER_TOUCH_MS = 3000;
/** Below this, there's nothing to loop through — two cards already fill the view. */
const MIN_ARTICLES_TO_LOOP = 3;

/**
 * Every seeded article is browsable here, not just the ones for wherever the
 * phone currently is — useMitigationArticles sorts the locally-relevant ones
 * to the front, so they land first without hiding the rest. The strip then
 * auto-advances two cards at a time and loops forever: the content is
 * rendered twice back to back, motion always runs forward, and once it
 * crosses past the end of the first copy it snaps back into it (unanimated,
 * at a pixel-identical position) rather than visibly rewinding. See
 * autoScrollCarousel.ts for the actual math.
 *
 * Renders nothing only when there's literally no seeded content at all — with
 * any content, showing all of it in some order is always more useful than
 * an empty section, so this doesn't gate on having a GPS fix the way
 * UnlocatedBeaconStrip gates on having a beacon position.
 */
export function MitigationStrip() {
  const { width: screenWidth } = useWindowDimensions();
  const { articles } = useMitigationArticles();
  const [openArticle, setOpenArticle] = useState<MitigationArticle | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardWidth = (screenWidth - SHEET_PADDING_PX * 2 - CARD_GAP_PX) / 2;
  const cardStepPx = cardWidth + CARD_GAP_PX;
  const contentWidth = articles.length * cardStepPx;

  function stopAutoScroll() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startAutoScroll() {
    stopAutoScroll();
    if (articles.length < MIN_ARTICLES_TO_LOOP) return;

    timerRef.current = setInterval(() => {
      const { animateToX } = advanceCarousel(scrollXRef.current, cardStepPx * 2, contentWidth);
      scrollXRef.current = animateToX;
      scrollRef.current?.scrollTo({ x: animateToX, animated: true });
    }, AUTO_ADVANCE_INTERVAL_MS);
  }

  useEffect(() => {
    startAutoScroll();
    return () => {
      stopAutoScroll();
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the loop geometry actually changes
  }, [articles.length, cardStepPx, contentWidth]);

  function handleScrollSettled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = event.nativeEvent.contentOffset.x;
    const settled = settleScrollPosition(x, contentWidth);
    scrollXRef.current = settled;
    if (settled !== x) {
      scrollRef.current?.scrollTo({ x: settled, animated: false });
    }
  }

  function handleTouchStart() {
    stopAutoScroll();
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
  }

  function handleTouchEnd() {
    resumeTimeoutRef.current = setTimeout(startAutoScroll, RESUME_AFTER_TOUCH_MS);
  }

  if (articles.length === 0) return null;

  // Rendered twice so the auto-advance can always scroll forward — see the
  // component doc comment above for why that's what makes the loop seamless.
  const displayArticles = [...articles, ...articles];

  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-medium uppercase text-typography-500">
        Mitigation for your area
      </Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMomentumScrollEnd={handleScrollSettled}
        onScrollEndDrag={handleScrollSettled}>
        {displayArticles.map((article, index) => (
          <MitigationCard
            key={`${article.id}-${index}`}
            article={article}
            width={cardWidth}
            onPress={() => setOpenArticle(article)}
          />
        ))}
      </ScrollView>

      <MitigationArticleModal article={openArticle} onClose={() => setOpenArticle(null)} />
    </View>
  );
}
