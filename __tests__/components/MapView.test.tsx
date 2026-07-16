import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { G } from 'react-native-svg';
import { MapView } from '@/src/components/map/MapView';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { BeaconType, type BeaconState } from '@/src/types/beacon';
import type { LocatedBeacon } from '@/src/utils/mapPlacement';

const SIZE = 280;
const CENTER = SIZE / 2;

function makeLocated(offset: { east: number; north: number }): LocatedBeacon {
  const beacon: BeaconState = {
    deviceId: 'abc123',
    beaconType: BeaconType.Person,
    isRelay: false,
    protocolVersion: 0,
    hopsRemaining: 3,
    latitude: -6.2,
    longitude: 106.8,
    timestamp: 0,
    sequence: 1,
    rawRssi: -60,
    smoothedRssi: -60,
    bucket: 'near',
    lastSeenAt: 0,
  };
  return { beacon, offset, distanceLabel: '50 m' };
}

// Mounted trees stay subscribed to the stores, so a later test's setState would
// re-render them outside act(). Unmount each one when its test finishes.
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

function render(located: LocatedBeacon[] = []) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <MapView located={located} focusedBeaconId={null} size={SIZE} />,
    );
  });
  mounted.push(tree);
  return tree;
}

/** The world group is the only one carrying a rotate() about the map centre. */
function worldRotation(tree: ReactTestRenderer.ReactTestRenderer): string | undefined {
  return tree.root
    .findAllByType(G)
    .map((node) => node.props.transform)
    .find((transform: unknown): transform is string =>
      typeof transform === 'string' && transform.includes(`, ${CENTER}, ${CENTER})`),
    );
}

beforeEach(() => {
  useBeaconStore.setState({ ownHeading: null });
  useSettingsStore.setState({ rotationMode: 'heading-up', mapSpanMeters: 150 });
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
});

describe('MapView', () => {
  it('renders with no beacons', () => {
    expect(() => render()).not.toThrow();
  });

  it('counter-rotates the world against the heading, so "up" is where you face', () => {
    // Facing east: the world turns anticlockwise, putting true north on your left.
    useBeaconStore.setState({ ownHeading: 90 });

    expect(worldRotation(render([makeLocated({ east: 0, north: 50 })]))).toBe(
      `rotate(-90, ${CENTER}, ${CENTER})`,
    );
  });

  it('holds the world still in north-up mode however the phone is turned', () => {
    useBeaconStore.setState({ ownHeading: 90 });
    useSettingsStore.setState({ rotationMode: 'north-up' });

    expect(worldRotation(render([makeLocated({ east: 0, north: 50 })]))).toBe(
      `rotate(0, ${CENTER}, ${CENTER})`,
    );
  });

  it('falls back to north-up before the compass has reported', () => {
    useBeaconStore.setState({ ownHeading: null });

    expect(worldRotation(render([makeLocated({ east: 0, north: 50 })]))).toBe(
      `rotate(0, ${CENTER}, ${CENTER})`,
    );
  });

  it('announces how many beacons it is actually showing', () => {
    const tree = render([makeLocated({ east: 0, north: 50 })]);
    const label = tree.root.findAll((node) => typeof node.props.accessibilityLabel === 'string')[0]
      .props.accessibilityLabel;

    expect(label).toContain('1 beacon with a known direction');
    expect(label).toContain('rotating to face your direction');
  });
});
