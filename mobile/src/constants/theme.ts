import { Platform } from 'react-native';

export const dark = {
  background: '#0a0a0a',
  surface: '#161A1D',
  mutedSurface: '#1D2125',
  border: '#2C333A',
  textPrimary: '#C7D1DB',
  textSecondary: '#596773',
  heading: '#DEE4EA',
  primary: '#e87824',
  primaryHex: '#E87824',
  secondary: '#fbbf24',
  destructive: '#ef4444',
  destructiveBg: 'rgba(239,68,68,0.1)',
  success: '#22c55e',
  mapMarkerBlue: '#2563eb',
  cardRing: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(0,0,0,0.5)',
  inputBg: 'rgba(255,255,255,0.03)',
} as const;

export const light = {
  background: '#f5f0eb',
  surface: '#fafaf8',
  mutedSurface: '#e5e5e5',
  border: '#d4d4d4',
  textPrimary: '#1c1917',
  textSecondary: '#78716c',
  heading: '#292524',
  primary: '#e87824',
  primaryHex: '#E87824',
  secondary: '#f59e0b',
  destructive: '#ef4444',
  destructiveBg: 'rgba(239,68,68,0.1)',
  success: '#22c55e',
  mapMarkerBlue: '#2563eb',
  cardRing: 'rgba(0,0,0,0.06)',
  overlay: 'rgba(0,0,0,0.3)',
  inputBg: 'rgba(0,0,0,0.02)',
} as const;

export type ThemeColors = typeof dark;

export const radii = {
  none: 0,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

const systemFont = Platform.select({ ios: 'System', default: 'sans-serif' });
const systemMono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const typography = {
  fontFamily: systemFont,
  fontFamilyRegular: systemFont,
  fontFamilyMedium: systemFont,
  fontFamilyBold: systemFont,
  fontFamilyExtraBold: systemFont,
  monoFamily: systemMono,
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  weights: {
    thin: '100' as const,
    normal: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};
