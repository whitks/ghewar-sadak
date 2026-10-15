import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { PotholeDetection } from '../services/api';
import { FusedEvent } from '../services/sensorFusionService';

export interface LiveCameraBBoxOverlayProps {
  detections: PotholeDetection[];
  containerWidth: number;
  containerHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  latestFusedEvent?: FusedEvent | null;
}

export function LiveCameraBBoxOverlay({
  detections,
  containerWidth,
  containerHeight,
  imageWidth = 1280,
  imageHeight = 720,
  latestFusedEvent,
}: LiveCameraBBoxOverlayProps) {
  if (!containerWidth || !containerHeight || detections.length === 0) {
    return null;
  }

  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;

  const isDualFused =
    latestFusedEvent &&
    latestFusedEvent.source === 'both' &&
    Date.now() - latestFusedEvent.timestamp < 4500;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {detections.map((d, index) => {
        const [x1, y1, x2, y2] = d.bbox;
        const left = Math.max(0, x1 * scaleX);
        const top = Math.max(0, y1 * scaleY);
        const boxWidth = Math.min(containerWidth - left, Math.max(36, (x2 - x1) * scaleX));
        const boxHeight = Math.min(containerHeight - top, Math.max(30, (y2 - y1) * scaleY));

        const isFusedBox = index === 0 && isDualFused;

        const borderColor = isFusedBox
          ? '#10b981'
          : d.severity === 'Critical' || d.severity === 'High'
          ? AppColors.accent
          : '#f59e0b';

        const bgColor = isFusedBox
          ? 'rgba(16, 185, 129, 0.18)'
          : d.severity === 'Critical' || d.severity === 'High'
          ? 'rgba(239, 68, 68, 0.16)'
          : 'rgba(245, 158, 11, 0.14)';

        const badgeColor = isFusedBox
          ? '#059669'
          : d.severity === 'Critical' || d.severity === 'High'
          ? AppColors.accent
          : '#d97706';

        const confPct = Math.round(d.confidence * 100);
        const depthText = d.estimated_depth_cm > 0 ? `~${d.estimated_depth_cm}cm` : '';

        return (
          <View
            key={`live-box-${d.id || index}-${d.class_name}`}
            style={[
              styles.bbox,
              {
                left,
                top,
                width: boxWidth,
                height: boxHeight,
                borderColor,
                backgroundColor: bgColor,
              },
            ]}
            pointerEvents="box-none"
          >
            {/* Top Floating Badge */}
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Ionicons
                name={isFusedBox ? 'flash' : 'warning'}
                size={11}
                color="#ffffff"
              />
              <Text style={styles.badgeText}>
                {isFusedBox
                  ? `DUAL FUSED ${Math.round(latestFusedEvent.fusedConfidence * 100)}%`
                  : `${d.class_name.toUpperCase()} ${confPct}%`}
              </Text>
              {depthText ? <Text style={styles.badgeSub}>· {depthText}</Text> : null}
              {isFusedBox && latestFusedEvent.peakG > 0 ? (
                <Text style={styles.badgeSub}>· {latestFusedEvent.peakG}G</Text>
              ) : null}
            </View>

            {/* Corner Bracket Accents (HUD Tactical Style) */}
            <View style={[styles.cornerTL, { borderColor }]} />
            <View style={[styles.cornerTR, { borderColor }]} />
            <View style={[styles.cornerBL, { borderColor }]} />
            <View style={[styles.cornerBR, { borderColor }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    zIndex: 20,
  },
  badge: {
    position: 'absolute',
    top: -26,
    left: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeSub: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.95,
  },
  cornerTL: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 10,
    height: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    width: 10,
    height: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 10,
    height: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
});
