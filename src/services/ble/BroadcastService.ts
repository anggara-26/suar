import BLEAdvertiser from 'react-native-ble-advertiser';
import { SUAR_SERVICE_UUID, SUAR_COMPANY_ID } from '@/src/protocol/constants';
import { encodeBeacon, type EncodeBeaconInput } from '@/src/protocol/beaconCodec';

let isBroadcasting = false;

async function startBroadcast(input: EncodeBeaconInput): Promise<void> {
  BLEAdvertiser.setCompanyId(SUAR_COMPANY_ID);
  const payload = encodeBeacon(input);
  await BLEAdvertiser.broadcast(SUAR_SERVICE_UUID, payload, {
    advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_LATENCY,
    txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_HIGH,
    connectable: false,
    includeDeviceName: false,
    includeTxPowerLevel: false,
  });
  isBroadcasting = true;
}

export async function stopBroadcast(): Promise<void> {
  if (!isBroadcasting) return;
  isBroadcasting = false;
  await BLEAdvertiser.stopBroadcast().catch(() => {});
}

/**
 * BLE advertisers need a stop+restart to change their content, so "updating"
 * the broadcast is really replacing it. Called on every heartbeat tick.
 */
export async function updateBroadcast(input: EncodeBeaconInput): Promise<void> {
  if (isBroadcasting) {
    await stopBroadcast();
  }
  await startBroadcast(input);
}
