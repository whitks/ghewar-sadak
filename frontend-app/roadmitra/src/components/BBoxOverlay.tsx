import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  LayoutChangeEvent,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { PotholeDetection } from '../services/api';

export interface BBoxOverlayProps {
  imageUri: string;
  detections: PotholeDetection[];
  imageWidth?: number;
  imageHeight?: number;
  onSelectDetection?: (detection: PotholeDetection) => void;
}

export function BBoxOverlay({
  imageUri,
  detections,
  imageWidth = 1280,
  imageHeight = 720,
  onSelectDetection,
}: BBoxOverlayProps) {
  const [containerDim, setContainerDim] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerDim({ width, height });
    }
  };

  const scaleX = containerDim ? containerDim.width / imageWidth : 1;
  const scaleY = containerDim ? containerDim.height / imageHeight : 1;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return AppColors.accent;
      case 'High':
        return AppColors.accentOrange;
      case 'Moderate':
        return '#eab308'; // Amber
      default:
        return AppColors.success;
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Background Image */}
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        resizeMode="contain"
      />

      {/* Render Bounding Boxes */}
      {containerDim &&
        detections.map((d, index) => {
          const [x1, y1, x2, y2] = d.bbox;
          const left = x1 * scaleX;
          const top = y1 * scaleY;
          const boxWidth = Math.max(20, (x2 - x1) * scaleX);
          const boxHeight = Math.max(20, (y2 - y1) * scaleY);
          const color = getSeverityColor(d.severity);
          const isSelected = selectedId === d.id || selectedId === index;

          return (
            <TouchableOpacity
              key={`${d.id || index}-${d.class_name}`}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedId(d.id || index);
                onSelectDetection?.(d);
              }}
              style={[
                styles.bbox,
                {
                  left,
                  top,
                  width: boxWidth,
                  height: boxHeight,
                  borderColor: color,
                  backgroundColor: isSelected ? 'rgba(225, 29, 72, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                },
              ]}
            >
              {/* Floating Label Badge */}
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Ionicons name="warning" size={10} color="#ffffff" />
                <Text style={styles.badgeText}>
                  {d.class_name} {Math.round(d.confidence * 100)}%
                </Text>
                {d.estimated_depth_cm > 0 && (
                  <Text style={styles.badgeDepth}>
                    · ~{d.estimated_depth_cm}cm
                  </Text>
                )}
              </View>

              {/* Corner Accents */}
              <View style={[styles.cornerTL, { borderColor: color }]} />
              <View style={[styles.cornerBR, { borderColor: color }]} />
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: '#050c09',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  badge: {
    position: 'absolute',
    top: -24,
    left: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeDepth: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.9,
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 8,
    height: 8,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 8,
    height: 8,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
});
