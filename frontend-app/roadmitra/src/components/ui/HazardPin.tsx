import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '../../constants/theme';

export interface HazardPinProps {
  type: string;
  confidence: number;
}

function getPinIcon(type: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (type.toLowerCase()) {
    case 'pothole':
      return 'alert-circle';
    case 'rough_patch':
      return 'texture-box';
    case 'alligator_crack':
      return 'vector-line';
    case 'speed_bump':
      return 'car-brake-alert';
    case 'flooding':
      return 'water-alert';
    case 'debris':
      return 'delete-empty';
    default:
      return 'alert-outline';
  }
}

function getPinColor(confidence: number): { border: string; bg: string; text: string } {
  if (confidence >= 0.75) {
    return { border: AppColors.success, bg: AppColors.successBg, text: AppColors.success };
  }
  if (confidence >= 0.5) {
    return { border: AppColors.warning, bg: AppColors.warningBg, text: AppColors.warning };
  }
  return { border: AppColors.danger, bg: AppColors.dangerBg, text: AppColors.danger };
}

export function HazardPin({ type, confidence }: HazardPinProps) {
  const icon = getPinIcon(type);
  const color = getPinColor(confidence);
  const confidencePct = Math.round(confidence * 100);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.pin, { borderColor: color.border, backgroundColor: color.bg }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color.border} />
      </View>
      <View style={[styles.tail, { borderTopColor: color.border }]} />
      <View style={[styles.confidenceBadge, { backgroundColor: color.border }]}>
        <Text style={styles.confidenceText}>{confidencePct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  confidenceBadge: {
    marginTop: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.surface,
    letterSpacing: 0.2,
  },
});
