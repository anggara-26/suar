import { useMemo } from 'react';
import { useBeaconStore } from '@/src/state/beaconStore';
import { findNearestTerritory } from '@/src/utils/territoryMatch';
import territoriesData from '@/src/data/territories.json';
import articlesData from '@/src/data/articles.json';
import type { Territory, MitigationArticle } from '@/src/types/education';

const territories = territoriesData as Territory[];
const articles = articlesData as MitigationArticle[];

/** ~1 km — coarse enough that the ~3 s GPS tick doesn't recompute the match on pure jitter. */
function roundForMatching(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Matches the phone's own GPS fix to the nearest seeded territory and returns
 * *every* seeded article — all of it is meant to be browsable, not just the
 * local slice — with whichever articles apply to the matched territory
 * sorted to the front. With no fix yet (or no seeded territory anywhere near
 * it), there's nothing to prioritize, so the full list comes back in its
 * plain authored order.
 */
export function useMitigationArticles(): { territory: Territory | null; articles: MitigationArticle[] } {
  const ownLocation = useBeaconStore((state) => state.ownLocation);

  // Rounded values only gate *when* the memo recomputes — the match itself
  // still runs on the full-precision ownLocation below.
  const roundedLat = ownLocation ? roundForMatching(ownLocation.latitude) : null;
  const roundedLon = ownLocation ? roundForMatching(ownLocation.longitude) : null;

  return useMemo(() => {
    const territory = findNearestTerritory(ownLocation, territories);
    if (!territory) return { territory: null, articles };

    const relevant: MitigationArticle[] = [];
    const rest: MitigationArticle[] = [];
    for (const article of articles) {
      (article.territoryIds.includes(territory.id) ? relevant : rest).push(article);
    }
    return { territory, articles: [...relevant, ...rest] };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the rounded coords, not every raw sample
  }, [roundedLat, roundedLon]);
}
