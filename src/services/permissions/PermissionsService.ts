import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, requestMultiple } from 'react-native-permissions';

const REQUIRED_ANDROID_PERMISSIONS = [
  PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
  PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
  PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
  PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
] as const;

/**
 * Requests, in order, everything a BLE broadcast/scan call needs. Android-only —
 * this project's BLE features aren't targeting iOS (see plan decision #2).
 * Deliberately skips ACCESS_BACKGROUND_LOCATION: the app stays foregrounded for
 * the whole demo, so background scan permission isn't needed for the MVP.
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const results = await requestMultiple([...REQUIRED_ANDROID_PERMISSIONS]);
  return Object.values(results).every((status) => status === RESULTS.GRANTED);
}
