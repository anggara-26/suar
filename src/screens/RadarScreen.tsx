import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Vibration } from 'react-native';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore } from '@/src/state/settingsStore';
import { BeaconType, type BeaconState, type RssiBucket } from '@/src/types/beacon';
import { MapView } from '@/src/components/map/MapView';
import { UnlocatedBeaconStrip } from '@/src/components/map/UnlocatedBeaconStrip';
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

function BeaconRow({
  beacon,
  isFocused,
  distanceLabel,
}: {
  beacon: BeaconState;
  isFocused: boolean;
  distanceLabel: string;
}) {
  const setFocusedBeacon = useBeaconStore((state) => state.setFocusedBeacon);
  const isAssembly = beacon.beaconType === BeaconType.Assembly;

  return (
    <Pressable
      onPress={() => setFocusedBeacon(isFocused ? null : beacon.deviceId)}
      accessibilityRole="button"
      accessibilityLabel={`${isAssembly ? 'Assembly point' : 'Person'} ${beacon.deviceId}, ${distanceLabel}${isFocused ? ', focused' : ''}`}
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
    </Pressable>
  );
}

export function RadarScreen() {
  const [isSheetOpen, setSheetOpen] = useState(false);
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

  return (
    <View className="flex-1 bg-background-0 px-4 pt-4">
      <AccessibleAnnouncer />

      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-typography-900">Suar</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open settings: assembly point, accessibility mode, disaster mode"
          className="rounded-full border border-outline-200 px-4 py-2">
          <Text className="text-sm font-medium text-typography-900">Settings</Text>
        </Pressable>
      </View>

      <VisualEmphasis
        emphasizedClassName="rounded-lg border border-outline-100 bg-background-50 p-2"
        className="mb-4">
        <Text className="text-sm text-typography-500">Your beacon ID: {ownDeviceId}</Text>
        {isAssemblyPoint ? (
          <Text className="text-sm font-semibold text-success-600">
            📍 Broadcasting as an assembly point
          </Text>
        ) : null}
      </VisualEmphasis>

      <View className="mb-3 items-center">
        <MapView located={located} focusedBeaconId={focusedBeaconId} />

        <View className="mt-2 flex-row">
          <Pressable
            onPress={() => setRotationMode(rotationMode === 'heading-up' ? 'north-up' : 'heading-up')}
            accessibilityRole="button"
            accessibilityLabel={
              rotationMode === 'heading-up'
                ? 'Map rotates to face your direction. Tap to lock north up.'
                : 'Map is locked north up. Tap to rotate with your direction.'
            }
            className="mr-2 rounded-full border border-outline-200 px-4 py-2">
            <Text className="text-sm font-medium text-typography-900">
              {rotationMode === 'heading-up' ? '▲ Heading up' : 'N North up'}
            </Text>
          </Pressable>

          <Pressable
            onPress={cycleMapSpan}
            accessibilityRole="button"
            accessibilityLabel={`Map range ${mapSpanMeters} metres across. Tap to change.`}
            className="rounded-full border border-outline-200 px-4 py-2">
            <Text className="text-sm font-medium text-typography-900">{mapSpanMeters} m</Text>
          </Pressable>
        </View>
      </View>

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
        <FlatList
          data={beaconList}
          keyExtractor={(beacon) => beacon.deviceId}
          renderItem={({ item }) => (
            <BeaconRow
              beacon={item}
              isFocused={item.deviceId === focusedBeaconId}
              distanceLabel={distanceLabels[item.deviceId]}
            />
          )}
        />
      )}

      <AssemblyToggleSheet visible={isSheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
