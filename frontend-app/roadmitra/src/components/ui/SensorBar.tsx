import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '../../constants/theme';

export type SensorStatus = 'good' | 'warn' | 'bad' | 'unknown';

export interface SensorBarProps {
  label: string;
  /** Normalised value between 0 and 1 */
  value: number;
  status: SensorStatus;
  unit?: string;
  rawValue?: string | number;
}

const STATUS_COLORS: Record<SensorStatus, { fill: string; bg: string }> = {
  good: { fill: AppColors.success, bg: AppColors.successBg },
  warn: { fill: AppColors.warning, bg: AppColors.warningBg },
  bad: { fill: AppColors.danger, bg: AppColors.dangerBg },
  unknown: { fill: AppColors.textMuted, bg: AppColors.cardAlt },
};

export function SensorBar({ label, value, status, unit, rawValue }: SensorBarProps) {
  const clampedValue = Math.min(1, Math.max(0, value));
  const colors = STATUS_COLORS[status];
  const displayValue = rawValue !== undefined ? rawValue : Math.round(clampedValue * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.valueText, { color: colors.fill }]}>
          {displayValue}
          {unit ? `\u202F${unit}` : rawValue === undefined ? '%' : ''}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: AppColors.borderLight }]}>
        <View
          style={[
            styles.fill,
            { width: `${clampedValue * 100}%`, backgroundColor: colors.fill },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
