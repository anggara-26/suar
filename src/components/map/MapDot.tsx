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
  /**
   * True when this position comes from two fixes too close together to trust
   * the bearing between them — a real GPS delta, just a noisy one. Rendered
   * dashed/translucent with a "~" on the label rather than hidden, so the
   * beacon stays visible instead of vanishing whenever two devices are close.
   */
  isApproximate: boolean;
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
  isApproximate,
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

      {/* Dashed, semi-transparent fill flags a bearing too close to its own GPS noise to trust. */}
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
          {isApproximate ? `~${distanceLabel}` : distanceLabel}
        </SvgText>
      </G>
    </G>
  );
}
