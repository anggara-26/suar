import { isGpsStale, GPS_CONSIDERED_STALE_MS } from '@/src/services/location/LocationService';

describe('isGpsStale', () => {
  it('is fresh right after a GPS fix, so a network poll is skipped', () => {
    const now = 100_000;
    expect(isGpsStale(now, now)).toBe(false);
  });

  it('is fresh just inside the window', () => {
    const now = 100_000;
    expect(isGpsStale(now - (GPS_CONSIDERED_STALE_MS - 1), now)).toBe(false);
  });

  it('is stale once GPS has been silent for the whole window', () => {
    const now = 100_000;
    expect(isGpsStale(now - GPS_CONSIDERED_STALE_MS, now)).toBe(true);
  });

  it('treats a never-seen GPS fix (0) as stale, so a device with no GPS uses the network', () => {
    expect(isGpsStale(0, GPS_CONSIDERED_STALE_MS)).toBe(true);
  });
});
