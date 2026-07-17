import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Circle, Defs, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { MapDot } from '@/src/components/map/MapDot';
import { useMapTheme } from '@/src/components/map/mapTheme';
import { useBeaconStore } from '@/src/state/beaconStore';
import { useSettingsStore, type MapSpanMeters } from '@/src/state/settingsStore';
import { projectOffsetToViewport } from '@/src/utils/mapViewport';
import type { LocatedBeacon } from '@/src/utils/mapPlacement';

interface MapViewProps {
  located: LocatedBeacon[];
  focusedBeaconId: string | null;
  width?: number;
  height?: number;
}

/** Chosen to land 5-6 gridlines across the map's shorter dimension at every span. */
const GRID_STEP_METERS: Record<MapSpanMeters, number> = { 50: 10, 150: 25, 300: 50 };

const DOT_INSET_PX = 18;
const CLIP_ID = 'suar-map-clip';

/**
 * "You" at the centre, no map tiles (no internet dependency). Fills whatever
 * rectangle it's given edge-to-edge — no inset frame, no circular clip — so a
 * screen-filling map actually uses every pixel instead of leaving corners
 * dead. The world — grid and all — rotates under a fixed arrow, so "up" is
 * always where the phone faces. The grid is what makes that rotation legible;
 * the range rings are rotation-invariant and only carry scale.
 *
 * Only beacons with a real GPS position (on both ends) are drawn here; a
 * device with no fix at all is the strip's job (see UnlocatedBeaconStrip).
 * A close-but-real position still gets a dot, just a dashed/translucent one
 * with a "~" on its label — a noisy bearing is still a bearing, so it stays
 * visible rather than disappearing. This view never invents an angle from
 * nothing — see utils/mapPlacement.ts.
 */
export function MapView({ located, focusedBeaconId, width = 280, height = 280 }: MapViewProps) {
  // Subscribed here rather than passed down: heading changes on every compass
  // sample, and pulling it in at the screen would re-render the beacon list too.
  const theme = useMapTheme();
  const ownHeading = useBeaconStore((state) => state.ownHeading);
  const rotationMode = useSettingsStore((state) => state.rotationMode);
  const mapSpanMeters = useSettingsStore((state) => state.mapSpanMeters);

  const centerX = width / 2;
  const centerY = height / 2;
  const displayHeading = rotationMode === 'heading-up' ? (ownHeading ?? 0) : 0;
  // The shorter side sets the scale; the longer side then simply shows more
  // world rather than being force-fit into a shape that wastes it.
  const pxPerMetre = Math.min(width, height) / mapSpanMeters;

  // Deliberately not dependent on heading: rotation is a transform on the world
  // group below, so turning the phone re-renders one attribute rather than
  // recomputing every dot.
  const dots = useMemo(
    () =>
      located.map(({ beacon, offset, distanceLabel, isApproximate }) => ({
        beacon,
        distanceLabel,
        isApproximate,
        ...projectOffsetToViewport(offset, { width, height, spanMeters: mapSpanMeters, dotInsetPx: DOT_INSET_PX }),
      })),
    [located, width, height, mapSpanMeters],
  );

  const approximateCount = useMemo(
    () => located.filter((entry) => entry.isApproximate).length,
    [located],
  );

  const gridStepPx = GRID_STEP_METERS[mapSpanMeters] * pxPerMetre;
  // Oversized so the rotated grid still covers every corner of the rectangle.
  const halfDiagonal = Math.sqrt(width ** 2 + height ** 2) / 2;
  const gridLines = useMemo(() => {
    const reach = Math.ceil(halfDiagonal / gridStepPx);
    return Array.from({ length: reach * 2 + 1 }, (_, i) => (i - reach) * gridStepPx);
  }, [halfDiagonal, gridStepPx]);

  // Pinned to grid-step multiples so the rings and the grid always agree,
  // whatever the span. Both land inside the shorter dimension at every zoom step.
  //
  // The labels are what make these rings worth drawing. Ring radius works out
  // as gridStep * min(width,height) / span, and gridStep tracks the span to
  // keep ~6 lines across — so 150 m and 300 m put their rings on identical
  // pixels. Without the metre value written on them the two zoom levels are
  // indistinguishable, and a ring you can't read a distance off is decoration.
  const rings = [1, 2].map((multiple) => ({
    meters: GRID_STEP_METERS[mapSpanMeters] * multiple,
    radiusPx: gridStepPx * multiple,
  }));

  // North sits at bearing 0, so on screen it lands opposite the rotation.
  // Anchored off the shorter half so it stays inside the frame on either axis.
  const northAngleRad = (-displayHeading * Math.PI) / 180;
  const northRadius = Math.min(centerX, centerY) - 10;
  const northX = centerX + Math.sin(northAngleRad) * northRadius;
  const northY = centerY - Math.cos(northAngleRad) * northRadius;

  return (
    <View
      accessible
      accessibilityLabel={`Map showing ${located.length} beacon${located.length === 1 ? '' : 's'} with a known direction${
        approximateCount > 0 ? ` (${approximateCount} approximate)` : ''
      }, ${rotationMode === 'heading-up' ? 'rotating to face your direction' : 'locked north up'}`}>
      <Svg width={width} height={height}>
        <Defs>
          <ClipPath id={CLIP_ID}>
            <Rect x={0} y={0} width={width} height={height} />
          </ClipPath>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill={theme.surface} />

        <G clipPath={`url(#${CLIP_ID})`}>
          <G transform={`rotate(${-displayHeading}, ${centerX}, ${centerY})`}>
            {gridLines.map((step) => (
              <G key={step}>
                <Line
                  x1={centerX + step}
                  y1={centerY - halfDiagonal}
                  x2={centerX + step}
                  y2={centerY + halfDiagonal}
                  stroke={theme.grid}
                  strokeWidth={1}
                />
                <Line
                  x1={centerX - halfDiagonal}
                  y1={centerY + step}
                  x2={centerX + halfDiagonal}
                  y2={centerY + step}
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
                isApproximate={dot.isApproximate}
                outwardAngleDegrees={dot.outwardAngleDegrees}
                counterRotationDegrees={displayHeading}
              />
            ))}
          </G>

          {/* Chrome below stays out of the rotated group — it belongs to the phone, not the world. */}
          {rings.map((ring) => (
            <G key={ring.meters}>
              <Circle
                cx={centerX}
                cy={centerY}
                r={ring.radiusPx}
                fill="none"
                stroke={theme.frame}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              <SvgText
                x={centerX}
                y={centerY + ring.radiusPx - 4}
                fontSize={9}
                fill={theme.north}
                textAnchor="middle">
                {`${ring.meters} m`}
              </SvgText>
            </G>
          ))}

          <SvgText x={northX} y={northY + 4} fontSize={12} fontWeight="bold" fill={theme.north} textAnchor="middle">
            N
          </SvgText>

          <Path
            d={`M ${centerX} ${centerY - 11} L ${centerX - 7} ${centerY + 8} L ${centerX} ${centerY + 3} L ${centerX + 7} ${centerY + 8} Z`}
            fill={theme.player}
          />
        </G>
      </Svg>
    </View>
  );
}
