import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { HazardStatus, STATUS_COLORS, STATUS_BG, STATUS_BORDER } from '@/constants/hazardTypes';

interface StatusBadgeProps {
  status: HazardStatus;
  style?: ViewStyle;
}

const STATUS_LABELS: Record<HazardStatus, string> = {
  confirmed: 'CONFIRMED',
  probable: 'PROBABLE',
  unconfirmed: 'UNCONFIRMED',
  stale: 'STALE',
  conflicting: 'CONFLICTING',
};

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const bg = STATUS_BG[status];
  const border = STATUS_BORDER[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
