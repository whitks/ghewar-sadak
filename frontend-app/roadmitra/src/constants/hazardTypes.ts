import { MaterialCommunityIcons } from '@expo/vector-icons';

export type HazardType =
  | 'pothole'
  | 'alligator_crack'
  | 'longitudinal_crack'
  | 'transverse_crack'
  | 'rough_patch'
  | 'speed_breaker'
  | 'other';

export type HazardStatus =
  | 'unconfirmed'
  | 'probable'
  | 'confirmed'
  | 'stale'
  | 'conflicting';

export type HazardSource = 'camera' | 'phone' | 'both';

export const HAZARD_LABELS: Record<HazardType, string> = {
  pothole: 'Pothole',
  alligator_crack: 'Alligator Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  rough_patch: 'Rough Patch',
  speed_breaker: 'Speed Breaker',
  other: 'Road Hazard',
};

export const HAZARD_VECTOR_ICONS: Record<HazardType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  pothole: 'alert-circle',
  alligator_crack: 'texture-box',
  longitudinal_crack: 'vector-line',
  transverse_crack: 'ray-vertex',
  rough_patch: 'road-variant',
  speed_breaker: 'car-brake-alert',
  other: 'alert-outline',
};

// Deprecated fallback for text-only
export const HAZARD_ICONS: Record<HazardType, string> = {
  pothole: '🕳️',
  alligator_crack: '🪨',
  longitudinal_crack: '〰️',
  transverse_crack: '➖',
  rough_patch: '🛤️',
  speed_breaker: '🚧',
  other: '⚠️',
};

export const STATUS_COLORS: Record<HazardStatus, string> = {
  confirmed: '#15803d',
  probable: '#b45309',
  unconfirmed: '#b91c1c',
  stale: '#64748b',
  conflicting: '#7c3aed',
};

export const STATUS_BG: Record<HazardStatus, string> = {
  confirmed: '#ecfdf5',
  probable: '#fffbeb',
  unconfirmed: '#fef2f2',
  stale: '#f1f5f9',
  conflicting: '#f5f3ff',
};

export const STATUS_BORDER: Record<HazardStatus, string> = {
  confirmed: '#bbf7d0',
  probable: '#fde68a',
  unconfirmed: '#fecaca',
  stale: '#e2e8f0',
  conflicting: '#ddd6fe',
};

export const HAZARD_TYPES_LIST: HazardType[] = [
  'pothole',
  'alligator_crack',
  'longitudinal_crack',
  'transverse_crack',
  'rough_patch',
  'speed_breaker',
  'other',
];
