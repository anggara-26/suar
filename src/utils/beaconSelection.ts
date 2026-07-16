import { BeaconType, type BeaconState } from '@/src/types/beacon';

/**
 * Assembly beacons take priority when present — "come here, safe" outranks
 * "find me" when a user has both in range. Ties broken by strongest smoothed
 * RSSI (closest). Shared by haptic focus (useBleLifecycle) and voice guidance
 * (useFocusedBeacon) so "which beacon matters" has one implementation.
 */
export function selectNearestBeacon(beacons: Record<string, BeaconState>): BeaconState | null {
  const list = Object.values(beacons);
  if (list.length === 0) return null;

  const byRssiDesc = (a: BeaconState, b: BeaconState) => b.smoothedRssi - a.smoothedRssi;
  const assembly = list.filter((b) => b.beaconType === BeaconType.Assembly).sort(byRssiDesc);
  if (assembly.length > 0) return assembly[0];
  return list.sort(byRssiDesc)[0];
}
