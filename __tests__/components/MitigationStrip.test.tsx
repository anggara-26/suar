import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { MitigationStrip } from '@/src/components/education/MitigationStrip';
import { MitigationCard } from '@/src/components/education/MitigationCard';
import { useBeaconStore } from '@/src/state/beaconStore';
import articlesData from '@/src/data/articles.json';

// A seeded territory's centroid (see src/data/territories.json) — DKI Jakarta,
// which src/data/articles.json tags with the flood and earthquake articles.
const JAKARTA = { latitude: -6.2, longitude: 106.8, accuracy: 5, timestamp: 0 };
const TOTAL_SEEDED_ARTICLES = articlesData.length;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<MitigationStrip />);
  });
  mounted.push(tree);
  return tree;
}

/** One entry per rendered MitigationCard — findAllByType matches the composite
 * component itself exactly once per instance, unlike a loose accessibilityLabel
 * predicate, which also matches whatever wrapper layers (e.g. NativeWind's
 * interop) forward the same prop underneath it. */
function cardTitles(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(MitigationCard).map((node) => node.props.article.title);
}

function findCardByTitle(tree: ReactTestRenderer.ReactTestRenderer, title: string) {
  return tree.root.findAllByType(MitigationCard).find((node) => node.props.article.title === title)!;
}

beforeEach(() => {
  jest.useFakeTimers();
  useBeaconStore.setState({ ownLocation: null });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('MitigationStrip', () => {
  it('shows every seeded article even with no GPS fix, in their authored order', () => {
    const tree = render();
    // Rendered twice for the auto-scroll loop (see autoScrollCarousel.ts) —
    // the *first copy* is what should match the authored order.
    expect(cardTitles(tree)).toHaveLength(TOTAL_SEEDED_ARTICLES * 2);
    expect(cardTitles(tree).slice(0, TOTAL_SEEDED_ARTICLES)).toEqual([
      'Before the flood season',
      'During an earthquake: Drop, Cover, Hold',
      'Living near an active volcano',
      'If you feel a strong quake near the coast',
    ]);
  });

  it("sorts the matched territory's articles to the front, without dropping the rest", () => {
    useBeaconStore.setState({ ownLocation: JAKARTA });
    const tree = render();

    const titles = cardTitles(tree).slice(0, TOTAL_SEEDED_ARTICLES);
    expect(titles).toHaveLength(TOTAL_SEEDED_ARTICLES);
    expect(new Set(titles).size).toBe(TOTAL_SEEDED_ARTICLES); // nothing dropped, nothing duplicated
    // Jakarta is tagged on the flood article and the all-of-Java earthquake
    // article — both belong at the front, ahead of the volcano/tsunami ones
    // that don't apply to Jakarta.
    expect(new Set(titles.slice(0, 2))).toEqual(
      new Set(['Before the flood season', 'During an earthquake: Drop, Cover, Hold']),
    );
  });

  it('still matches the nearest seeded territory from very far away', () => {
    // Nearest-centroid has no distance cutoff by design (see territoryMatch.ts)
    // — a phone on the other side of the world still gets *a* match, just an
    // inaccurate one — and still shows every article, only the ordering changes.
    useBeaconStore.setState({ ownLocation: { ...JAKARTA, latitude: 51.5, longitude: -0.1 } });
    const tree = render();
    expect(cardTitles(tree)).toHaveLength(TOTAL_SEEDED_ARTICLES * 2);
  });

  it('opens the full article on tap', () => {
    useBeaconStore.setState({ ownLocation: JAKARTA });
    const tree = render();

    const card = findCardByTitle(tree, 'Before the flood season');
    ReactTestRenderer.act(() => card.props.onPress());

    const modalTitle = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .join('');
    expect(modalTitle).toContain('Before the flood season');
  });

  it('closes the article modal', () => {
    useBeaconStore.setState({ ownLocation: JAKARTA });
    const tree = render();

    const card = findCardByTitle(tree, 'Before the flood season');
    ReactTestRenderer.act(() => card.props.onPress());

    const closeButton = tree.root.findAll(
      (node) => node.props.accessibilityLabel === 'Close' && typeof node.props.onPress === 'function',
    )[0];
    expect(closeButton).toBeDefined();

    ReactTestRenderer.act(() => closeButton.props.onPress());
    // Modal's `visible` prop drops back to false; RN's Modal keeps rendering
    // its subtree regardless in the test renderer, so assert on that prop
    // directly rather than on visible output.
    const modal = tree.root.findByProps({ animationType: 'slide' });
    expect(modal.props.visible).toBe(false);
  });

  it('does not leave an auto-advance timer running after unmount', () => {
    useBeaconStore.setState({ ownLocation: JAKARTA });
    render();
    expect(jest.getTimerCount()).toBeGreaterThan(0); // the auto-advance interval did start

    ReactTestRenderer.act(() => {
      mounted.pop()!.unmount();
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
