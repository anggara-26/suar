import { useBeaconStore } from '@/src/state/beaconStore';

beforeEach(() => {
  useBeaconStore.setState({ seenMessages: {} });
});

describe('beaconStore relay dedup', () => {
  it('marks and recognizes a seen message', () => {
    const store = useBeaconStore.getState();
    expect(store.hasSeenMessage('abc:1')).toBe(false);
    store.markMessageSeen('abc:1');
    expect(useBeaconStore.getState().hasSeenMessage('abc:1')).toBe(true);
  });

  it('evicts entries older than the given TTL and keeps fresher ones', () => {
    const store = useBeaconStore.getState();
    const now = Date.now();

    useBeaconStore.setState({
      seenMessages: {
        'old:1': now - 10_000,
        'fresh:1': now - 1_000,
      },
    });

    store.pruneSeenMessages(5_000);

    const seen = useBeaconStore.getState().seenMessages;
    expect(seen['old:1']).toBeUndefined();
    expect(seen['fresh:1']).toBeDefined();
  });
});
