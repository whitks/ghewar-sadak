import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Hazard } from '../services/mockData';
import { HAZARD_VECTOR_ICONS, HAZARD_LABELS } from '../constants/hazardTypes';
import { StatusBadge } from './ui/StatusBadge';
import { AppColors } from '../constants/theme';

interface HazardCardProps {
  hazard: Hazard;
  onPress?: () => void;
}

export function HazardCard({ hazard, onPress }: HazardCardProps) {
  const confidencePct = Math.round(hazard.confidence * 100);
  const confidenceColor =
    hazard.confidence >= 0.75
      ? AppColors.success
      : hazard.confidence >= 0.5
      ? AppColors.warning
      : AppColors.danger;

  const vectorIcon = HAZARD_VECTOR_ICONS[hazard.type] || 'alert-circle';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={vectorIcon} size={24} color={AppColors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.typeName}>{HAZARD_LABELS[hazard.type] || 'Road Defect'}</Text>
          <StatusBadge status={hazard.status} />
        </View>
        <View style={styles.confidence}>
          <Text style={[styles.confidenceNum, { color: confidenceColor }]}>
            {confidencePct}%
          </Text>
          <Text style={styles.confidenceLabel}>confidence</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <View style={styles.sourceRow}>
          {hazard.source === 'both' ? (
            <>
              <Ionicons name="camera" size={13} color={AppColors.textSecondary} />
              <Text style={styles.sourceText}>Vision + </Text>
              <Ionicons name="phone-portrait-outline" size={13} color={AppColors.textSecondary} />
              <Text style={styles.sourceText}>Phone Telemetry</Text>
            </>
          ) : hazard.source === 'camera' ? (
            <>
              <Ionicons name="camera" size={13} color={AppColors.textSecondary} />
              <Text style={styles.sourceText}>Vision AI</Text>
            </>
          ) : (
            <>
              <Ionicons name="phone-portrait-outline" size={13} color={AppColors.textSecondary} />
              <Text style={styles.sourceText}>Phone IMU</Text>
            </>
          )}
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.deviceCount}>
            {hazard.deviceCount} report{hazard.deviceCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {hazard.description && (
        <Text style={styles.description} numberOfLines={2}>
          {hazard.description}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  typeName: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  confidence: { alignItems: 'flex-end' },
  confidenceNum: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  confidenceLabel: {
    color: AppColors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  dotSeparator: {
    color: AppColors.textMuted,
    marginHorizontal: 4,
  },
  deviceCount: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    color: AppColors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
});
