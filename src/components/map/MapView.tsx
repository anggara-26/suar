import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { MapDot } from '@/src/components/map/MapDot';
import { useMapTheme } from '@/src/components/map/mapTheme';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore, type MapSpanMeters } from '@/src/state/settingsStore';
import { projectOffsetToViewport } from '@/src/utils/mapViewport';
import type { LocatedBeacon } from '@/src/utils/mapPlacement';

interface MapViewProps {
  located: LocatedBeacon[];
  focusedBeaconId: string | null;
  size?: number;
}

/** Chosen to land 5-6 gridlines across the map at every span. */
const GRID_STEP_METERS: Record<MapSpanMeters, number> = { 50: 10, 150: 25, 300: 50 };

const DOT_INSET_PX = 18;
const CLIP_ID = 'suar-map-clip';

/**
 * "You" at the centre, no map tiles (no internet dependency). A square,
 * player-centric, heading-up map: the world — grid and all — rotates under a
 * fixed arrow, so "up" is always where the phone faces.
 *
 * Only beacons with a direction we'd stand behind are drawn here; everything
 * else is the strip's job (see UnlocatedBeaconStrip). A dot's position on a map
 * reads as a claim about where someone *is*, so this view never renders a
 * guessed angle — see utils/mapPlacement.ts.
 */
export function MapView({ located, focusedBeaconId, size = 280 }: MapViewProps) {
  // Subscribed here rather than passed down: heading changes on every compass
  // sample, and pulling it in at the screen would re-render the beacon list too.
  const theme = useMapTheme();
  const ownHeading = useBeaconStore((state) => state.ownHeading);
  const rotationMode = useSettingsStore((state) => state.rotationMode);
  const mapSpanMeters = useSettingsStore((state) => state.mapSpanMeters);

  const center = size / 2;
  const displayHeading = rotationMode === 'heading-up' ? (ownHeading ?? 0) : 0;
  const pxPerMetre = size / mapSpanMeters;

  // Deliberately not dependent on heading: rotation is a transform on the world
  // group below, so turning the phone re-renders one attribute rather than
  // recomputing every dot.
  const dots = useMemo(
    () =>
      located.map(({ beacon, offset, distanceLabel }) => ({
        beacon,
        distanceLabel,
        ...projectOffsetToViewport(offset, { size, spanMeters: mapSpanMeters, dotInsetPx: DOT_INSET_PX }),
      })),
    [located, size, mapSpanMeters],
  );

  const gridStepPx = GRID_STEP_METERS[mapSpanMeters] * pxPerMetre;
  // Oversized so the rotated grid still covers the square's corners.
  const halfDiagonal = (size * Math.SQRT2) / 2;
  const gridLines = useMemo(() => {
    const reach = Math.ceil(halfDiagonal / gridStepPx);
    return Array.from({ length: reach * 2 + 1 }, (_, i) => (i - reach) * gridStepPx);
  }, [halfDiagonal, gridStepPx]);

  // North sits at bearing 0, so on screen it lands opposite the rotation.
  const northAngleRad = (-displayHeading * Math.PI) / 180;
  const northRadius = center - 10;
  const northX = center + Math.sin(northAngleRad) * northRadius;
  const northY = center - Math.cos(northAngleRad) * northRadius;

  return (
    <View
      accessible
      accessibilityLabel={`Map showing ${located.length} beacon${located.length === 1 ? '' : 's'} with a known direction, ${
        rotationMode === 'heading-up' ? 'rotating to face your direction' : 'locked north up'
      }`}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id={CLIP_ID}>
            <Rect x={0} y={0} width={size} height={size} rx={12} />
          </ClipPath>
        </Defs>

        <Rect x={0} y={0} width={size} height={size} rx={12} fill={theme.surface} stroke={theme.frame} strokeWidth={1} />

        <G clipPath={`url(#${CLIP_ID})`}>
          <G transform={`rotate(${-displayHeading}, ${center}, ${center})`}>
            {gridLines.map((step) => (
              <G key={step}>
                <Line
                  x1={center + step}
                  y1={center - halfDiagonal}
                  x2={center + step}
                  y2={center + halfDiagonal}
                  stroke={theme.grid}
                  strokeWidth={1}
                />
                <Line
                  x1={center - halfDiagonal}
                  y1={center + step}
                  x2={center + halfDiagonal}
                  y2={center + step}
                  stroke={theme.grid}
                  strokeWidth={1}
                />
              </G>
            ))}

            {dots.map((dot) => (
              <MapDot
                key={dot.beacon.deviceId}
                cx={dot.cx}
                cy={dot.cy}
                beacon={dot.beacon}
                distanceLabel={dot.distanceLabel}
                isFocused={dot.beacon.deviceId === focusedBeaconId}
                isOffMap={dot.isOffMap}
                outwardAngleDegrees={dot.outwardAngleDegrees}
                counterRotationDegrees={displayHeading}
              />
            ))}
          </G>

          {/* Chrome below stays out of the rotated group — it belongs to the phone, not the world. */}
          <SvgText x={northX} y={northY + 4} fontSize={12} fontWeight="bold" fill={theme.north} textAnchor="middle">
            N
          </SvgText>

          <Path
            d={`M ${center} ${center - 11} L ${center - 7} ${center + 8} L ${center} ${center + 3} L ${center + 7} ${center + 8} Z`}
            fill={theme.player}
          />
        </G>
      </Svg>
    </View>
  );
}
