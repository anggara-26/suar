import { View, Text, Pressable, ScrollView } from 'react-native';
import { useBeaconStore } from '@/src/state/beaconStore';
import { BeaconType } from '@/src/types/beacon';
import type { UnlocatedBeacon } from '@/src/utils/mapPlacement';

interface UnlocatedBeaconStripProps {
  unlocated: UnlocatedBeacon[];
  focusedBeaconId: string | null;
}

/**
 * Home for every beacon the map can't honestly place — no GPS fix on one end,
 * or the two phones are close enough that the bearing between them would be
 * noise. At short range that is *most* beacons, so this strip is a primary
 * surface, not a footnote: it carries the same tap-to-focus and the same
 * label shape as the list rows.
 */
export function UnlocatedBeaconStrip({ unlocated, focusedBeaconId }: UnlocatedBeaconStripProps) {
  const setFocusedBeacon = useBeaconStore((state) => state.setFocusedBeacon);

  if (unlocated.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-medium uppercase text-typography-500">
        Direction unknown
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {unlocated.map(({ beacon, distanceLabel }) => {
          const isFocused = beacon.deviceId === focusedBeaconId;
          const isAssembly = beacon.beaconType === BeaconType.Assembly;

          return (
            <Pressable
              key={beacon.deviceId}
              onPress={() => setFocusedBeacon(isFocused ? null : beacon.deviceId)}
              accessibilityRole="button"
              accessibilityLabel={`${isAssembly ? 'Assembly point' : 'Person'} ${beacon.deviceId}, ${distanceLabel}, direction unknown${isFocused ? ', focused' : ''}`}
              className={`mr-2 rounded-full border px-3 py-2 ${
                isFocused ? 'border-primary-500 bg-primary-50' : 'border-outline-200 bg-background-0'
              }`}>
              <Text className="text-sm font-medium text-typography-900">
                {isAssembly ? '📍' : '🧍'} {beacon.deviceId} · {distanceLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
