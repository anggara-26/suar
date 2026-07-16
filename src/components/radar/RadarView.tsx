import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { RadarDot } from '@/src/components/radar/RadarDot';
import { placeBeaconOnRadar } from '@/src/utils/radarPlacement';
import type { BeaconState } from '@/src/types/beacon';
import type { LocationSample } from '@/src/services/location/LocationService';

interface RadarViewProps {
  beacons: BeaconState[];
  ownLocation: LocationSample | null;
  focusedBeaconId: string | null;
  size?: number;
}

const RING_FRACTIONS = [0.33, 0.66, 1];

/**
 * "You" at the center, no map tiles (no internet dependency). Positions come
 * from placeBeaconOnRadar — a real true-north GPS bearing when both fixes are
 * valid, otherwise a visually-flagged RSSI-distance approximation. Never
 * implies a bearing this app hasn't actually computed.
 */
export function RadarView({ beacons, ownLocation, focusedBeaconId, size = 280 }: RadarViewProps) {
  const center = size / 2;
  const usableRadius = center - 16;

  const points = useMemo(
    () =>
      beacons.map((beacon) => ({
        beacon,
        point: placeBeaconOnRadar(ownLocation, beacon),
      })),
    [beacons, ownLocation],
  );

  return (
    <View
      accessible
      accessibilityLabel={`Radar showing ${beacons.length} nearby beacon${beacons.length === 1 ? '' : 's'}`}>
      <Svg width={size} height={size}>
        {RING_FRACTIONS.map((fraction) => (
          <Circle
            key={fraction}
            cx={center}
            cy={center}
            r={usableRadius * fraction}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1}
          />
        ))}
        <Line x1={center} y1={16} x2={center} y2={size - 16} stroke="#E2E8F0" strokeWidth={1} />
        <Line x1={16} y1={center} x2={size - 16} y2={center} stroke="#E2E8F0" strokeWidth={1} />

        <Circle cx={center} cy={center} r={8} fill="#111827" />

        {points.map(({ beacon, point }) => (
          <RadarDot
            key={beacon.deviceId}
            cx={center + point.x * usableRadius}
            cy={center + point.y * usableRadius}
            beacon={beacon}
            isApproximate={point.isApproximate}
            isFocused={beacon.deviceId === focusedBeaconId}
          />
        ))}
      </Svg>
    </View>
  );
}
