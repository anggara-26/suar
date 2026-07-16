/**
 * BLE service UUID using the 16-bit-pattern form of the Bluetooth Base UUID.
 * Android's BLE stack auto-shortens this to a 2-byte UUID in the advertisement,
 * leaving ~20 usable manufacturer-data bytes. A random 128-bit UUID would shrink
 * that budget to 6 bytes — not enough for our payload. 0xFFF0 falls in the range
 * the Bluetooth SIG designates for testing/development use (no registration
 * required), which is what this prototype needs.
 */
export const SUAR_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';

/** SIG-reserved "testing only" company ID — not a real assigned vendor ID. */
export const SUAR_COMPANY_ID = 0xffff;

export const PROTOCOL_VERSION = 0;

/** Rebuild + rebroadcast the payload on this interval, decoupled from GPS sample rate. */
export const BROADCAST_INTERVAL_MS = 4000;

/** Drop a beacon from the discovered list if not seen again within this window. */
export const BEACON_STALE_AFTER_MS = 15000;

/** hopsRemaining set by the originating device for a direct (non-relayed) broadcast. */
export const MAX_HOPS_SINGLE_HOP = 1;

/** hopsRemaining ceiling once multi-hop mesh relay (F9, stretch) is enabled. */
export const MAX_HOPS_MESH = 3;

/** How often a relaying device rotates its single advertising slot between frames. */
export const RELAY_ROTATION_INTERVAL_MS = 750;

/** Max number of distinct beacons a relay will keep in its rotation at once. */
export const RELAY_ROTATION_MAX_FRAMES = 5;

/** Mesh dedup "seen" entries older than this are evicted. */
export const SEEN_MESSAGE_TTL_MS = 5 * 60 * 1000;

/** How often the seen-set eviction sweep runs. */
export const SEEN_MESSAGE_SWEEP_INTERVAL_MS = 30 * 1000;
