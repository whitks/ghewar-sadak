import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/theme';

export type StatVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'lime';

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: StatVariant;
  style?: ViewStyle | ViewStyle[];
}

export function StatCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = 'default',
  style,
}: StatCardProps) {
  const colors = getVariantColors(variant);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {icon && (
          <View style={[styles.iconBox, { backgroundColor: colors.iconBg }]}>
            <Ionicons name={icon} size={16} color={colors.iconColor} />
          </View>
        )}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function getVariantColors(variant: StatVariant) {
  switch (variant) {
    case 'primary':
      return { iconBg: AppColors.primary + '15', iconColor: AppColors.primary };
    case 'lime':
      return { iconBg: AppColors.secondary, iconColor: AppColors.primary };
    case 'success':
      return { iconBg: AppColors.successBg, iconColor: AppColors.success };
    case 'warning':
      return { iconBg: AppColors.warningBg, iconColor: AppColors.warning };
    case 'danger':
      return { iconBg: AppColors.dangerBg, iconColor: AppColors.danger };
    default:
      return { iconBg: AppColors.cardAlt, iconColor: AppColors.textSecondary };
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
    marginRight: 6,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  subtitle: {
    fontSize: 11,
    color: AppColors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
});
