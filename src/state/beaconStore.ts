import { create } from 'zustand';
import type { BeaconState, BeaconType } from '@/src/types/beacon';
import { getDeviceId } from '@/src/protocol/deviceId';
import type { LocationSample } from '@/src/services/location/LocationService';
import {
  smoothRssi,
  rssiToBucket,
  applyHysteresis,
  createBucketTransitionState,
  type BucketTransitionState,
} from '@/src/utils/rssiSmoothing';
import { smoothHeading } from '@/src/utils/headingSmoothing';

interface UpsertBeaconInput {
  deviceId: string;
  beaconType: BeaconType;
  isRelay: boolean;
  hopsRemaining: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  sequence: number;
  rawRssi: number;
}

interface BeaconStoreState {
  ownIdentity: { deviceId: string; sequence: number };
  ownLocation: LocationSample | null;
  /** Smoothed compass heading in degrees from true north, null until the sensor reports. */
  ownHeading: number | null;
  discoveredBeacons: Record<string, BeaconState>;
  bucketTransitions: Record<string, BucketTransitionState>;
  /** Relay dedup: "deviceId:sequence" -> timestamp first seen. */
  seenMessages: Record<string, number>;
  focusedBeaconId: string | null;

  incrementSequence: () => number;
  setOwnDeviceId: (deviceId: string) => void;
  setOwnLocation: (sample: LocationSample) => void;
  setOwnHeading: (heading: number) => void;
  upsertBeacon: (input: UpsertBeaconInput) => void;
  pruneStaleBeacons: (staleAfterMs: number) => void;
  setFocusedBeacon: (deviceId: string | null) => void;
  markMessageSeen: (messageId: string) => void;
  hasSeenMessage: (messageId: string) => boolean;
  pruneSeenMessages: (ttlMs: number) => void;
}

export const useBeaconStore = create<BeaconStoreState>()((set, get) => ({
  ownIdentity: { deviceId: getDeviceId(), sequence: 0 },
  ownLocation: null,
  ownHeading: null,
  discoveredBeacons: {},
  bucketTransitions: {},
  seenMessages: {},
  focusedBeaconId: null,

  incrementSequence: () => {
    const next = (get().ownIdentity.sequence + 1) % 65536;
    set((state) => ({ ownIdentity: { ...state.ownIdentity, sequence: next } }));
    return next;
  },

  setOwnDeviceId: (deviceId) =>
    set((state) => ({ ownIdentity: { ...state.ownIdentity, deviceId } })),

  setOwnLocation: (sample) => set({ ownLocation: sample }),

  setOwnHeading: (heading) =>
    set((state) => ({ ownHeading: smoothHeading(state.ownHeading, heading) })),

  upsertBeacon: (input) => {
    set((state) => {
      const existing = state.discoveredBeacons[input.deviceId];

      // Staleness guard: frames carry the origin's build timestamp, so within
      // one device they're totally ordered. An older frame (typically a relay
      // still echoing pre-change state, or a leftover advertisement from a
      // previous app session) must never overwrite newer state — without this
      // the device appears to flip-flop between old and new state as direct
      // and relayed frames interleave. Equal timestamps are re-reports of the
      // same frame and only allowed when not losing a direct frame to a relay.
      if (existing) {
        if (input.timestamp < existing.timestamp) return state;
        if (input.timestamp === existing.timestamp && input.isRelay && !existing.isRelay) {
          return state;
        }
      }

      const smoothedRssi = smoothRssi(existing?.smoothedRssi ?? null, input.rawRssi);
      const candidateBucket = rssiToBucket(smoothedRssi);

      const priorTransition =
        state.bucketTransitions[input.deviceId] ?? createBucketTransitionState(candidateBucket);
      const nextTransition = applyHysteresis(priorTransition, candidateBucket);

      const beacon: BeaconState = {
        deviceId: input.deviceId,
        beaconType: input.beaconType,
        isRelay: input.isRelay,
        protocolVersion: 0,
        hopsRemaining: input.hopsRemaining,
        latitude: input.latitude,
        longitude: input.longitude,
        timestamp: input.timestamp,
        sequence: input.sequence,
        rawRssi: input.rawRssi,
        smoothedRssi,
        bucket: nextTransition.currentBucket,
        lastSeenAt: Date.now(),
      };

      return {
        discoveredBeacons: { ...state.discoveredBeacons, [input.deviceId]: beacon },
        bucketTransitions: { ...state.bucketTransitions, [input.deviceId]: nextTransition },
      };
    });
  },

  pruneStaleBeacons: (staleAfterMs) => {
    set((state) => {
      const now = Date.now();
      const next: Record<string, BeaconState> = {};
      for (const [id, beacon] of Object.entries(state.discoveredBeacons)) {
        if (now - beacon.lastSeenAt <= staleAfterMs) {
          next[id] = beacon;
        }
      }
      return { discoveredBeacons: next };
    });
  },

  setFocusedBeacon: (deviceId) => set({ focusedBeaconId: deviceId }),

  markMessageSeen: (messageId) => {
    set((state) => ({ seenMessages: { ...state.seenMessages, [messageId]: Date.now() } }));
  },

  hasSeenMessage: (messageId) => messageId in get().seenMessages,

  pruneSeenMessages: (ttlMs) => {
    set((state) => {
      const now = Date.now();
      const next: Record<string, number> = {};
      for (const [id, seenAt] of Object.entries(state.seenMessages)) {
        if (now - seenAt <= ttlMs) next[id] = seenAt;
      }
      return { seenMessages: next };
    });
  },
}));
