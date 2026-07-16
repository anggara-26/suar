import { create } from 'zustand';
import type { AccessibilityMode } from '@/src/types/accessibility';

interface SettingsStoreState {
  accessibilityMode: AccessibilityMode;
  /** Anyone can flip this — no coordinator/role system (plan decision #3). */
  isAssemblyPoint: boolean;
  disasterMode: boolean;
  setAccessibilityMode: (mode: AccessibilityMode) => void;
  setIsAssemblyPoint: (value: boolean) => void;
  setDisasterMode: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>()((set) => ({
  accessibilityMode: 'standard',
  isAssemblyPoint: false,
  disasterMode: false,
  setAccessibilityMode: (mode) => set({ accessibilityMode: mode }),
  setIsAssemblyPoint: (value) => set({ isAssemblyPoint: value }),
  setDisasterMode: (value) => set({ disasterMode: value }),
}));
