import { findNearestTerritory } from '@/src/utils/territoryMatch';
import type { Territory } from '@/src/types/education';
import type { LocationSample } from '@/src/services/location/LocationService';

const TERRITORIES: Territory[] = [
  { id: 'north', name: 'North', centroid: { lat: 10, lon: 0 } },
  { id: 'south', name: 'South', centroid: { lat: -10, lon: 0 } },
  { id: 'east', name: 'East', centroid: { lat: 0, lon: 10 } },
];

function makeLocation(overrides: Partial<LocationSample> = {}): LocationSample {
  return { latitude: 0, longitude: 0, accuracy: 5, timestamp: 0, ...overrides };
}

describe('findNearestTerritory', () => {
  it('picks the closest centroid', () => {
    const match = findNearestTerritory(makeLocation({ latitude: 9, longitude: 0.5 }), TERRITORIES);
    expect(match?.id).toBe('north');
  });

  it('picks a different territory when closer to it instead', () => {
    const match = findNearestTerritory(makeLocation({ latitude: 0.5, longitude: 9 }), TERRITORIES);
    expect(match?.id).toBe('east');
  });

  it('returns null when there is no own location at all', () => {
    expect(findNearestTerritory(null, TERRITORIES)).toBeNull();
  });

  it('returns null for the (0,0) no-fix-yet placeholder', () => {
    const match = findNearestTerritory(makeLocation({ latitude: 0, longitude: 0 }), TERRITORIES);
    expect(match).toBeNull();
  });

  it('returns null for non-finite coordinates', () => {
    const match = findNearestTerritory(makeLocation({ latitude: NaN, longitude: 5 }), TERRITORIES);
    expect(match).toBeNull();
  });

  it('returns null when there are no territories to match against', () => {
    const match = findNearestTerritory(makeLocation({ latitude: 9, longitude: 0 }), []);
    expect(match).toBeNull();
  });

  it('breaks a tie by keeping the first territory encountered', () => {
    // Any point on lat=0 is exactly equidistant from north (10,0) and south
    // (-10,0) by symmetry; -0.001 longitude (not +0.001) keeps it farther
    // from east (0,10) too, so this is a genuine two-way tie, not a
    // three-way one that happens to read as "north" by accident.
    const match = findNearestTerritory(makeLocation({ latitude: 0, longitude: -0.001 }), TERRITORIES);
    expect(match?.id).toBe('north');
  });
});
