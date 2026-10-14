import { Platform } from 'react-native';

// ─── Organic Whitish / Cream Palette (FoodShelterConnect style) ───────────────
export const AppColors = {
  // Brand Core
  primary: '#18352b',       // Deep Forest Dark Ink
  primaryLight: '#264e40',  // Slightly lighter forest
  secondary: '#d7ee85',     // Vibrant Lime Accent
  accent: '#e11d48',        // Alert Hazard Crimson
  accentOrange: '#ea580c',  // Road Orange
  lime: '#9fbd42',          // Lime Accent Green
  coral: '#ef8c5c',         // Soft Warm Coral
  teal: '#5c9686',          // Sage Teal

  // Backgrounds & Surfaces (Whitish/Paper/Organic Cream)
  bg: '#f4f2eb',            // Organic Warm Cream Page Background
  surface: '#ffffff',       // Pure Clean White Surface
  card: '#ffffff',          // White Card Surface
  cardAlt: '#eef2ea',       // Soft Sage Card Container
  cardMuted: '#f8f7f2',     // Paper Muted Card
  border: '#e2e7dc',        // Subtle Line Border
  borderLight: '#edf1e8',   // Lightest Border
  borderFocus: '#18352b',   // Focused Line Border
  shadow: '#cbd7c2',        // Soft Organic Shadow

  // Status & Badges
  success: '#15803d',
  successBg: '#ecfdf5',
  successBorder: '#bbf7d0',

  warning: '#b45309',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',

  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',

  info: '#0369a1',
  infoBg: '#f0f9ff',
  infoBorder: '#bae6fd',

  // Typography
  textPrimary: '#18352b',   // Deep Forest High Contrast Ink
  textSecondary: '#607067', // Warm Slate Muted
  textMuted: '#8a9990',     // Light Slate Subtext
  textWhite: '#ffffff',
} as const;

export const Colors = {
  light: {
    text: AppColors.textPrimary,
    background: AppColors.bg,
    backgroundElement: AppColors.cardMuted,
    backgroundSelected: AppColors.cardAlt,
    textSecondary: AppColors.textSecondary,
  },
  dark: {
    text: AppColors.textPrimary,
    background: AppColors.bg,
    backgroundElement: AppColors.cardMuted,
    backgroundSelected: AppColors.cardAlt,
    textSecondary: AppColors.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    rounded: '"SF Pro Rounded", sans-serif',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
