import { create } from 'zustand';

interface SettingsStoreState {
  /**
   * Accessibility channels are all on by default — a disaster tool must work
   * for everyone from first launch with zero setup. Settings only let a user
   * turn a channel off (e.g. Deaf users muting voice, hearing-aid users
   * killing vibration), never require turning one on. The radar itself has no
   * toggle: the visual channel is always on.
   */
  voiceEnabled: boolean;
  hapticsEnabled: boolean;
  /** Anyone can flip this — no coordinator/role system (plan decision #3). */
  isAssemblyPoint: boolean;
  disasterMode: boolean;
  /** How many metres the map spans edge to edge. */
  mapSpanMeters: MapSpanMeters;
  /**
   * Heading-up spins the world under a fixed "you" arrow, like a game minimap.
   * North-up is the escape hatch for a noisy or absent magnetometer — a map
   * that rotates wrongly is worse than one that doesn't rotate at all.
   */
  rotationMode: RotationMode;
  setVoiceEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setIsAssemblyPoint: (value: boolean) => void;
  setDisasterMode: (value: boolean) => void;
  cycleMapSpan: () => void;
  setRotationMode: (value: RotationMode) => void;
}

export type RotationMode = 'heading-up' | 'north-up';

export const MAP_SPAN_STEPS = [50, 150, 300] as const;
export type MapSpanMeters = (typeof MAP_SPAN_STEPS)[number];

export const useSettingsStore = create<SettingsStoreState>()((set) => ({
  voiceEnabled: true,
  hapticsEnabled: true,
  isAssemblyPoint: false,
  disasterMode: false,
  mapSpanMeters: 150,
  rotationMode: 'heading-up',
  setVoiceEnabled: (value) => set({ voiceEnabled: value }),
  setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
  setIsAssemblyPoint: (value) => set({ isAssemblyPoint: value }),
  setDisasterMode: (value) => set({ disasterMode: value }),
  cycleMapSpan: () =>
    set((state) => {
      const next = MAP_SPAN_STEPS[(MAP_SPAN_STEPS.indexOf(state.mapSpanMeters) + 1) % MAP_SPAN_STEPS.length];
      return { mapSpanMeters: next };
    }),
  setRotationMode: (value) => set({ rotationMode: value }),
}));
