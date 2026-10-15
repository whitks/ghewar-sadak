import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { FusedEvent } from '../services/sensorFusionService';
import { PotholeDetection } from '../services/api';

export interface UnifiedFusionResultCardProps {
  latestFusedEvent: FusedEvent | null;
  latestDetections: PotholeDetection[];
  vibrationRms: number;
  speedKmh: number;
  roadQuality: string;
  lastError?: string | null;
  isProcessingFrame?: boolean;
}

export function UnifiedFusionResultCard({
  latestFusedEvent,
  latestDetections,
  vibrationRms,
  speedKmh,
  roadQuality,
  lastError,
  isProcessingFrame,
}: UnifiedFusionResultCardProps) {
  const hasDualFused =
    latestFusedEvent &&
    latestFusedEvent.source === 'both' &&
    Date.now() - latestFusedEvent.timestamp < 12000;

  const hasRecentFused =
    latestFusedEvent && Date.now() - latestFusedEvent.timestamp < 10000;

  const hasActiveVisual = latestDetections && latestDetections.length > 0;

  // Determine current unified status
  let statusBadge = {
    title: isProcessingFrame
      ? 'YOLO MODEL INGESTING FRAME'
      : lastError
      ? 'BACKEND CONNECTION RETRYING'
      : 'MODEL SCAN ACTIVE · ROAD CLEAR',
    badgeBg: lastError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
    badgeBorder: lastError ? AppColors.accent : '#10b981',
    badgeText: lastError ? AppColors.accent : '#10b981',
    icon: lastError ? 'alert-circle' : isProcessingFrame ? 'sync' : 'shield-checkmark',
  };

  let primaryTitle = isProcessingFrame
    ? 'Analyzing Frame with Model...'
    : lastError
    ? 'Backend Model Standby'
    : 'Road Surface Clear';
  let primarySub = lastError
    ? `Backend message: ${lastError}`
    : 'Frames sent every 3s to backend AI model · 50Hz vibration active.';
  let confPercent = lastError ? 0 : 95;
  let stat1Label = 'VIBRATION RMS';
  let stat1Val = `${vibrationRms.toFixed(2)} G`;
  let stat2Label = 'SURFACE QUALITY';
  let stat2Val = roadQuality.toUpperCase();

  if (hasDualFused) {
    statusBadge = {
      title: 'DUAL MULTI-MODAL FUSED',
      badgeBg: '#064e3b',
      badgeBorder: '#10b981',
      badgeText: '#6ee7b7',
      icon: 'flash',
    };
    confPercent = Math.round(latestFusedEvent.fusedConfidence * 100);
    primaryTitle = `${latestFusedEvent.type.toUpperCase()}: DUAL CONFIRMED`;
    primarySub = latestFusedEvent.description;
    stat1Label = 'VISUAL AI DEPTH';
    stat1Val = `~${latestFusedEvent.estimatedDepthCm} cm`;
    stat2Label = 'IMU PEAK IMPACT';
    stat2Val = `${latestFusedEvent.peakG} G`;
  } else if (hasActiveVisual) {
    const topD = latestDetections[0];
    statusBadge = {
      title: 'MODEL DETECTION: POTHOLE',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeBorder: '#3b82f6',
      badgeText: '#3b82f6',
      icon: 'videocam',
    };
    confPercent = Math.round(topD.confidence * 100);
    primaryTitle = `${topD.class_name.toUpperCase()} DETECTED BY MODEL`;
    primarySub = `Severity: ${topD.severity} · Depth: ~${topD.estimated_depth_cm || 4.5}cm · Awaiting wheel impact`;
    stat1Label = 'MODEL CONFIDENCE';
    stat1Val = `${confPercent}%`;
    stat2Label = 'ESTIMATED DEPTH';
    stat2Val = topD.estimated_depth_cm > 0 ? `~${topD.estimated_depth_cm} cm` : 'Moderate';
  } else if (hasRecentFused && latestFusedEvent.source === 'phone') {
    statusBadge = {
      title: 'PHYSICAL SHOCK REGISTERED',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeBorder: '#f59e0b',
      badgeText: '#f59e0b',
      icon: 'pulse',
    };
    confPercent = Math.round(latestFusedEvent.fusedConfidence * 100);
    primaryTitle = `${latestFusedEvent.type.toUpperCase()} STRIKE`;
    primarySub = latestFusedEvent.description;
    stat1Label = 'SHOCK IMPACT';
    stat1Val = `${latestFusedEvent.peakG} G`;
    stat2Label = 'ESTIMATED DEPTH';
    stat2Val = `~${latestFusedEvent.estimatedDepthCm} cm`;
  }

  return (
    <View style={styles.card}>
      {/* Header Badge */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: statusBadge.badgeBg, borderColor: statusBadge.badgeBorder },
          ]}
        >
          <Ionicons name={statusBadge.icon as any} size={13} color={statusBadge.badgeText} />
          <Text style={[styles.badgeText, { color: statusBadge.badgeText }]}>
            {statusBadge.title}
          </Text>
        </View>

        <Text style={styles.speedPill}>
          {speedKmh > 0 ? `${speedKmh} km/h` : 'STATIONARY'}
        </Text>
      </View>

      {/* Main Defect Title & Explanation */}
      <View style={styles.contentBox}>
        <Text style={styles.title}>{primaryTitle}</Text>
        <Text style={styles.sub}>{primarySub}</Text>
      </View>

      {/* Confidence Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>SINGLE UNIFIED CONFIDENCE</Text>
          <Text style={styles.progressValue}>{confPercent}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.max(6, Math.min(100, confPercent))}%`,
                backgroundColor: statusBadge.badgeBorder,
              },
            ]}
          />
        </View>
      </View>

      {/* Sensor Metric Pillars */}
      <View style={styles.metricsStrip}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>{stat1Label}</Text>
          <Text style={styles.metricValue}>{stat1Val}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>{stat2Label}</Text>
          <Text style={styles.metricValue}>{stat2Val}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  speedPill: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textSecondary,
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contentBox: {
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: AppColors.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    lineHeight: 16,
    fontWeight: '500',
  },
  progressContainer: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textSecondary,
    letterSpacing: 0.8,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '900',
    color: AppColors.textPrimary,
  },
  progressBarBg: {
    height: 7,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: AppColors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: AppColors.border,
  },
});
