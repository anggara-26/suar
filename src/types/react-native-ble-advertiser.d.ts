/**
 * react-native-ble-advertiser's shipped .d.ts only declares its methods —
 * the AdvertiseSettings/ScanSettings constants are injected at runtime via
 * the native module's getConstants() and aren't part of the static types.
 */
export {};

declare module 'react-native-ble-advertiser' {
  export const ADVERTISE_MODE_BALANCED: number;
  export const ADVERTISE_MODE_LOW_LATENCY: number;
  export const ADVERTISE_MODE_LOW_POWER: number;
  export const ADVERTISE_TX_POWER_HIGH: number;
  export const ADVERTISE_TX_POWER_LOW: number;
  export const ADVERTISE_TX_POWER_MEDIUM: number;
  export const ADVERTISE_TX_POWER_ULTRA_LOW: number;
  export const SCAN_MODE_BALANCED: number;
  export const SCAN_MODE_LOW_LATENCY: number;
  export const SCAN_MODE_LOW_POWER: number;
  export const SCAN_MODE_OPPORTUNISTIC: number;
  export const MATCH_MODE_AGGRESSIVE: number;
  export const MATCH_MODE_STICKY: number;
  export const MATCH_NUM_FEW_ADVERTISEMENT: number;
  export const MATCH_NUM_MAX_ADVERTISEMENT: number;
  export const MATCH_NUM_ONE_ADVERTISEMENT: number;
}
