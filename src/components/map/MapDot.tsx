import { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { BeaconType, type BeaconState } from '@/src/types/beacon';
import { useMapTheme } from '@/src/components/map/mapTheme';

interface MapDotProps {
  cx: number;
  cy: number;
  beacon: BeaconState;
  distanceLabel: string;
  isFocused: boolean;
  /** True when the beacon is beyond the map's span and has been pulled to the edge. */
  isOffMap: boolean;
  /** Outward direction in screen degrees (0 = up), used to aim the off-map chevron. */
  outwardAngleDegrees: number;
  /** Undoes the world rotation so text stays upright. */
  counterRotationDegrees: number;
  radius?: number;
}

const PERSON_COLOR = '#0EA5E9';
const ASSEMBLY_COLOR = '#16A34A';
const FOCUS_RING_COLOR = '#F59E0B';

export function MapDot({
  cx,
  cy,
  beacon,
  distanceLabel,
  isFocused,
  isOffMap,
  outwardAngleDegrees,
  counterRotationDegrees,
  radius = 10,
}: MapDotProps) {
  const theme = useMapTheme();
  const isAssembly = beacon.beaconType === BeaconType.Assembly;
  const fillColor = isAssembly ? ASSEMBLY_COLOR : PERSON_COLOR;

  return (
    <G>
      {isFocused ? (
        <Circle cx={cx} cy={cy} r={radius + 6} fill="none" stroke={FOCUS_RING_COLOR} strokeWidth={2} />
      ) : null}

      {/* Chevron aimed away from centre: this beacon is further out than the map currently shows. */}
      {isOffMap ? (
        <G transform={`rotate(${outwardAngleDegrees}, ${cx}, ${cy})`}>
          <Path
            d={`M ${cx} ${cy - radius - 7} L ${cx - 5} ${cy - radius - 1} L ${cx + 5} ${cy - radius - 1} Z`}
            fill={fillColor}
          />
        </G>
      ) : null}

      <Circle cx={cx} cy={cy} r={radius} fill={fillColor} />

      {isAssembly ? (
        <G transform={`rotate(${counterRotationDegrees}, ${cx}, ${cy})`}>
          <SvgText x={cx} y={cy + 4} fontSize={10} fontWeight="bold" fill="#fff" textAnchor="middle">
            A
          </SvgText>
        </G>
      ) : null}

      <G transform={`rotate(${counterRotationDegrees}, ${cx}, ${cy})`}>
        <SvgText
          x={cx}
          y={cy + radius + 12}
          fontSize={10}
          fontWeight="600"
          fill={theme.label}
          textAnchor="middle">
          {distanceLabel}
        </SvgText>
      </G>
    </G>
  );
}
