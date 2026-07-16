import { NativeEventEmitter, type NativeModule } from 'react-native';
import BLEAdvertiser from 'react-native-ble-advertiser';
import { SUAR_SERVICE_UUID, SUAR_COMPANY_ID } from '@/src/protocol/constants';
import { decodeBeacon } from '@/src/protocol/beaconCodec';
import type { BeaconObservation } from '@/src/types/beacon';

export interface ScanEvent {
  observation: BeaconObservation;
  rssi: number;
}

type ScanListener = (event: ScanEvent) => void;
type NativeDeviceFoundEvent = {
  manufData?: number[];
  rssi: number;
};

let emitter: NativeEventEmitter | null = null;

function getEmitter(): NativeEventEmitter {
  if (!emitter) {
    // BLEAdvertiser's own module export *is* the native module instance
    // (react-native-ble-advertiser/index.js: `module.exports = NativeModules.BLEAdvertiser`),
    // so it doubles as the NativeEventEmitter's event source.
    emitter = new NativeEventEmitter(BLEAdvertiser as unknown as NativeModule);
  }
  return emitter;
}

let subscription: { remove: () => void } | null = null;
let isScanning = false;

export async function startScan(onBeacon: ScanListener): Promise<void> {
  if (isScanning) return;

  BLEAdvertiser.setCompanyId(SUAR_COMPANY_ID);

  subscription = getEmitter().addListener('onDeviceFound', (device: NativeDeviceFoundEvent) => {
    if (!device.manufData) return;
    try {
      const observation = decodeBeacon(device.manufData);
      onBeacon({ observation, rssi: device.rssi });
    } catch {
      // Payload wasn't ours (foreign device sharing the service UUID by chance,
      // or a malformed frame) — drop it silently rather than crash the scanner.
    }
  });

  isScanning = true;
  try {
    await BLEAdvertiser.scanByService(SUAR_SERVICE_UUID, {
      scanMode: BLEAdvertiser.SCAN_MODE_LOW_LATENCY,
      matchMode: BLEAdvertiser.MATCH_MODE_AGGRESSIVE,
    });
  } catch (error) {
    // Scanning is core (F2): a device that broadcasts but can't hear anyone
    // must fail loudly, not sit on an empty radar forever.
    isScanning = false;
    subscription?.remove();
    subscription = null;
    throw new Error(`BLE scan failed to start: ${String(error)}`);
  }
}

export async function stopScan(): Promise<void> {
  if (!isScanning) return;
  isScanning = false;
  subscription?.remove();
  subscription = null;
  await BLEAdvertiser.stopScan().catch(() => {});
}
