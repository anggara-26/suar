import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { BeaconType, type BeaconState, type RssiBucket } from '@/src/types/beacon';
import { MapView } from '@/src/components/map/MapView';
import { UnlocatedBeaconStrip } from '@/src/components/map/UnlocatedBeaconStrip';
import { MitigationStrip } from '@/src/components/education/MitigationStrip';
import { partitionBeaconsForMap } from '@/src/utils/mapPlacement';
import { AssemblyToggleSheet } from '@/src/components/AssemblyToggleSheet';
import { AccessibleAnnouncer } from '@/src/components/accessibility/AccessibleAnnouncer';
import { VisualEmphasis } from '@/src/components/accessibility/VisualEmphasis';
import { useVoiceGuidance } from '@/src/hooks/useVoiceGuidance';

const BUCKET_LABEL: Record<RssiBucket, string> = {
  'very-near': 'Very near',
  near: 'Near',
  medium: 'Medium',
  far: 'Far',
};

const APPROXIMATE_REASON =
  'devices are close enough together that GPS noise could point the arrow either way';

function BeaconRow({
  beacon,
  isFocused,
  distanceLabel,
  isApproximate,
}: {
  beacon: BeaconState;
  isFocused: boolean;
  distanceLabel: string;
  isApproximate: boolean;
}) {
  const setFocusedBeacon = useBeaconStore((state) => state.setFocusedBeacon);
  const isAssembly = beacon.beaconType === BeaconType.Assembly;

  return (
    <Pressable
      onPress={() => setFocusedBeacon(isFocused ? null : beacon.deviceId)}
      accessibilityRole="button"
      accessibilityLabel={`${isAssembly ? 'Assembly point' : 'Person'} ${beacon.deviceId}, ${distanceLabel}${isApproximate ? `, position approximate — ${APPROXIMATE_REASON}` : ''
        }${isFocused ? ', focused' : ''}`}
      className={`mb-3 rounded-xl border px-4 py-3 ${isFocused ? 'border-primary-500 bg-primary-50' : 'border-outline-200 bg-background-0'
        }`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-typography-900">
          {isAssembly ? '📍 Assembly point' : '🧍 Person'} · {beacon.deviceId}
        </Text>
        {beacon.isRelay ? <Text className="text-xs text-typography-500">relayed</Text> : null}
      </View>
      <Text className="mt-1 text-sm text-typography-600">
        {distanceLabel} · {BUCKET_LABEL[beacon.bucket]} · {Math.round(beacon.smoothedRssi)} dBm
      </Text>
      {isApproximate ? (
        <Text className="mt-1 text-xs text-warning-600">
          ~ Approximate position — {APPROXIMATE_REASON}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Fraction of screen height the beacon list occupies. A real bottom sheet
 * would let the user drag this open/closed or resize it; this one is fixed on
 * purpose (see plan decision), so a static fraction is all that's needed —
 * no gesture handler, no snap points, no animated height.
 */
const BEACON_LIST_HEIGHT_FRACTION = 0.42;

export function RadarScreen() {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const beacons = useBeaconStore((state) => state.discoveredBeacons);
  const focusedBeaconId = useBeaconStore((state) => state.focusedBeaconId);
  const ownDeviceId = useBeaconStore((state) => state.ownIdentity.deviceId);
  const ownLocation = useBeaconStore((state) => state.ownLocation);
  const isAssemblyPoint = useSettingsStore((state) => state.isAssemblyPoint);
  const mapSpanMeters = useSettingsStore((state) => state.mapSpanMeters);
  const rotationMode = useSettingsStore((state) => state.rotationMode);
  const cycleMapSpan = useSettingsStore((state) => state.cycleMapSpan);
  const setRotationMode = useSettingsStore((state) => state.setRotationMode);
  useVoiceGuidance();

  const beaconList = useMemo(
    () => Object.values(beacons).sort((a, b) => b.smoothedRssi - a.smoothedRssi),
    [beacons],
  );

  // Partitioned once here, then handed to both the map and the list — they must
  // agree on what's placeable, and recomputing is how they drift apart.
  const { located, unlocated } = useMemo(
    () => partitionBeaconsForMap(ownLocation, beaconList),
    [ownLocation, beaconList],
  );

  const distanceLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const { beacon, distanceLabel } of located) labels[beacon.deviceId] = distanceLabel;
    for (const { beacon, distanceLabel } of unlocated) labels[beacon.deviceId] = distanceLabel;
    return labels;
  }, [located, unlocated]);

  const approximateBeaconIds = useMemo(() => {
    const ids = new Set<string>();
    for (const { beacon, isApproximate } of located) {
      if (isApproximate) ids.add(beacon.deviceId);
    }
    return ids;
  }, [located]);

  // Edge-to-edge: the map is the screen's base layer, not an inset card, so
  // the header/controls float over its top on translucent-ish chrome. The
  // fixed sheet is different — it's a large opaque panel, so the map is only
  // given the band actually free of it (the sheet still paints over its own
  // footprint, but now that's just "the map ends where the sheet begins," not
  // a shape getting sliced open).
  const beaconListHeight = Math.round(screenHeight * BEACON_LIST_HEIGHT_FRACTION);
  const mapAreaHeight = screenHeight - beaconListHeight;

  return (
    <View className="flex-1 bg-background-0">
      <AccessibleAnnouncer />

      <View className="absolute left-0 right-0 top-0" style={{ height: mapAreaHeight }}>
        <MapView
          located={located}
          focusedBeaconId={focusedBeaconId}
          width={screenWidth}
          height={mapAreaHeight}
        />

        <View className="mt-3 flex-row items-center justify-between absolute left-0 right-0 bottom-0 px-4 pb-2" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="flex-row items-center">
            <Pressable
              onPress={() => setRotationMode(rotationMode === 'heading-up' ? 'north-up' : 'heading-up')}
              accessibilityRole="button"
              accessibilityLabel={
                rotationMode === 'heading-up'
                  ? 'Map rotates to face your direction. Tap to lock north up.'
                  : 'Map is locked north up. Tap to rotate with your direction.'
              }
              className="mr-2 rounded-full border border-outline-200 bg-background-0 px-4 py-2 shadow-sm">
              <Text className="text-sm font-medium text-typography-900">
                {rotationMode === 'heading-up' ? '▲ Heading up' : 'N North up'}
              </Text>
            </Pressable>

            <Pressable
              onPress={cycleMapSpan}
              accessibilityRole="button"
              accessibilityLabel={`Map range ${mapSpanMeters} metres across. Tap to change.`}
              className="rounded-full border border-outline-200 bg-background-0 px-4 py-2 shadow-sm">
              <Text className="text-sm font-medium text-typography-900">{mapSpanMeters} m</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open settings: assembly point, accessibility mode, disaster mode"
            className="rounded-full border border-outline-200 bg-background-0 px-4 py-2 shadow-sm">
            <Text className="text-sm font-medium text-typography-900">Settings</Text>
          </Pressable>
        </View>
      </View>

      <View
        className="absolute left-0 right-0 top-0 px-4"
        style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-start justify-between">
          <Text className="text-2xl font-bold text-typography-900">SUAR</Text>

          <VisualEmphasis
            emphasizedClassName="rounded-lg border border-outline-100 bg-background-0 p-2 shadow-sm">
            <Text className="text-sm text-typography-500">Your beacon ID: {ownDeviceId}</Text>
            {isAssemblyPoint ? (
              <Text className="text-sm font-semibold text-success-600">
                📍 Broadcasting as an assembly point
              </Text>
            ) : null}
          </VisualEmphasis>
        </View>

      </View>

      {/*
        Styled like a bottom sheet (rounded top, drag-handle bar) but pinned at
        a fixed height — unlike AssemblyToggleSheet (an actual modal the user
        opens/closes), this one is always present and never moves. The handle
        bar is purely decorative: it signals "this is a sheet" without
        promising a drag gesture that isn't there.
      */}
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-background-0 px-4 pt-3 shadow-lg"
        style={{ height: beaconListHeight, paddingBottom: insets.bottom + 8 }}>
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline-200" />

        <MitigationStrip />

        <UnlocatedBeaconStrip unlocated={unlocated} focusedBeaconId={focusedBeaconId} />

        {beaconList.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text
              className="text-center text-base text-typography-500"
              accessibilityLiveRegion="polite">
              Broadcasting your presence. Looking for nearby beacons…
            </Text>
          </View>
        ) : (
          // Explicit style (not className): the sheet above it has a fixed
          // height, and FlatList needs a bounded flex box of its own to
          // scroll internally rather than growing past the sheet's edge.
          <FlatList
            style={{ flex: 1 }}
            data={beaconList}
            keyExtractor={(beacon) => beacon.deviceId}
            renderItem={({ item }) => (
              <BeaconRow
                beacon={item}
                isFocused={item.deviceId === focusedBeaconId}
                distanceLabel={distanceLabels[item.deviceId]}
                isApproximate={approximateBeaconIds.has(item.deviceId)}
              />
            )}
          />
        )}
      </View>

      <AssemblyToggleSheet visible={isSheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
