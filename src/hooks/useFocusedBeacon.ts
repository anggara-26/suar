import { useBeaconStore } from '@/src/state/beaconStore';
import { selectNearestBeacon } from '@/src/utils/beaconSelection';
import type { BeaconState } from '@/src/types/beacon';

/**
 * Resolves the single "which beacon matters right now" target that haptic
 * (useBleLifecycle), voice guidance, and radar highlighting all agree on:
 * the user's explicit tap-to-focus pick, or the nearest beacon by default.
 */
export function useFocusedBeacon(): BeaconState | null {
  const focusedBeaconId = useBeaconStore((state) => state.focusedBeaconId);
  const beacons = useBeaconStore((state) => state.discoveredBeacons);

  if (focusedBeaconId) {
    return beacons[focusedBeaconId] ?? null;
  }
  return selectNearestBeacon(beacons);
}
