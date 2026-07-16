import { Circle, G, Text as SvgText } from 'react-native-svg';
import { BeaconType, type BeaconState } from '@/src/types/beacon';

interface RadarDotProps {
  cx: number;
  cy: number;
  beacon: BeaconState;
  isApproximate: boolean;
  isFocused: boolean;
  radius?: number;
}

const PERSON_COLOR = '#0EA5E9';
const ASSEMBLY_COLOR = '#16A34A';
const FOCUS_RING_COLOR = '#F59E0B';

export function RadarDot({ cx, cy, beacon, isApproximate, isFocused, radius = 10 }: RadarDotProps) {
  const isAssembly = beacon.beaconType === BeaconType.Assembly;
  const fillColor = isAssembly ? ASSEMBLY_COLOR : PERSON_COLOR;

  return (
    <G>
      {isFocused ? (
        <Circle
          cx={cx}
          cy={cy}
          r={radius + 6}
          fill="none"
          stroke={FOCUS_RING_COLOR}
          strokeWidth={2}
        />
      ) : null}
      {/* Dashed, semi-transparent fill flags an RSSI-only guess rather than a real GPS bearing. */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fillColor}
        fillOpacity={isApproximate ? 0.35 : 1}
        stroke={fillColor}
        strokeWidth={isApproximate ? 2 : 0}
        strokeDasharray={isApproximate ? '3,3' : undefined}
      />
      {isAssembly ? (
        <SvgText x={cx} y={cy + 4} fontSize={10} fontWeight="bold" fill="#fff" textAnchor="middle">
          A
        </SvgText>
      ) : null}
    </G>
  );
}
