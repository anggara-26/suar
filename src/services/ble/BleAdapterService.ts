import { BleManager, State, type Subscription } from 'react-native-ble-plx';

/**
 * react-native-ble-plx is deliberately narrowed to exactly one job in this app:
 * detecting the Bluetooth adapter's power state and triggering Android's system
 * enable prompt. The actual broadcast/scan hot path is owned entirely by
 * react-native-ble-advertiser (see BroadcastService/ScanService) — ble-plx has no
 * GATT-server/peripheral support on Android, so it isn't in that path at all.
 */

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}

export async function getAdapterState(): Promise<State> {
  return getManager().state();
}

export function onAdapterStateChange(
  listener: (state: State) => void,
  emitCurrentState = true,
): Subscription {
  return getManager().onStateChange(listener, emitCurrentState);
}

/** Blocks until Bluetooth is powered on, prompting the user via Android's system dialog if needed. */
export async function ensureBluetoothEnabled(): Promise<void> {
  const state = await getAdapterState();
  if (state !== State.PoweredOn) {
    await getManager().enable();
  }
}
