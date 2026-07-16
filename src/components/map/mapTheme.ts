import { useColorScheme } from 'react-native';

export interface MapTheme {
  surface: string;
  frame: string;
  grid: string;
  player: string;
  north: string;
  label: string;
}

/**
 * The map is drawn with react-native-svg, which takes plain colour props and
 * doesn't see the nativewind classes the rest of the screen is themed with —
 * so the two palettes have to be spelled out. Without this the map stays a
 * stark white panel in an otherwise dark UI.
 */
const LIGHT: MapTheme = {
  surface: '#F8FAFC',
  frame: '#CBD5E1',
  grid: '#E2E8F0',
  player: '#111827',
  north: '#94A3B8',
  label: '#475569',
};

const DARK: MapTheme = {
  surface: '#0F172A',
  frame: '#334155',
  grid: '#1E293B',
  player: '#F1F5F9',
  north: '#64748B',
  label: '#94A3B8',
};

/** Tracks the system scheme, matching how App.tsx drives the gluestack provider. */
export function useMapTheme(): MapTheme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
