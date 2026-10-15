import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { AppColors } from '../constants/theme';
import { BACKEND_URL } from '../services/api';

export interface ModelVideoFeedProps {
  vibrationRms: number;
  dynamicGForce: number;
  verticalGForce?: number;
  roadQuality?: 'smooth' | 'good' | 'moderate' | 'rough';
  speed?: number;
  feedMode?: 'model_video' | 'camera';
  onToggleFeedMode?: () => void;
  children?: React.ReactNode;
}

export function ModelVideoFeed({
  vibrationRms,
  dynamicGForce,
  verticalGForce = 1.0,
  roadQuality = 'smooth',
  speed = 0,
  feedMode = 'model_video',
  onToggleFeedMode,
  children,
}: ModelVideoFeedProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isPlaying, setIsPlaying] = useState(true);

  // Pulse animation for high vibration warnings
  const isHighVibration = vibrationRms >= 0.18 || dynamicGForce >= 0.40 || roadQuality === 'rough';
  const isModerateVibration = !isHighVibration && (vibrationRms >= 0.08 || roadQuality === 'moderate');

  useEffect(() => {
    if (isHighVibration) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 350, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 350, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isHighVibration, pulseAnim]);

  // Video URLs with multiple fallback sources
  const videoSources = [
    `http://localhost:8000/api/videos/detected_road_footage.mp4`,
    `${BACKEND_URL}/api/videos/sample_video_annotated.mp4`,
    `${BACKEND_URL}/api/videos/detected_road_footage.mp4`,
    `https://ghewar-sadak.onrender.com/api/videos/sample_video_annotated.mp4`,
  ];

  const primaryVideoUrl = videoSources[0];

  const webViewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; background:#000; }
    html, body { width:100%; height:100%; overflow:hidden; }
    video {
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }
  </style>
</head>
<body>
  <video id="vid" autoplay loop muted playsinline webkit-playsinline preload="auto">
    <source src="${videoSources[0]}" type="video/mp4" />
    <source src="${videoSources[1]}" type="video/mp4" />
    <source src="${videoSources[2]}" type="video/mp4" />
    <source src="${videoSources[3]}" type="video/mp4" />
  </video>
  <script>
    var v = document.getElementById('vid');
    v.play().catch(function(){});
  </script>
</body>
</html>`;

  return (
    <View style={styles.container}>
      {feedMode === 'model_video' ? (
        Platform.OS === 'web' ? (
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            >
              <source src={videoSources[0]} type="video/mp4" />
              <source src={videoSources[1]} type="video/mp4" />
              <source src={videoSources[2]} type="video/mp4" />
              <source src={videoSources[3]} type="video/mp4" />
            </video>
          </div>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: webViewHtml }}
            style={styles.webView}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
          />
        )
      ) : (
        children
      )}

      {/* Top HUD: Mode Badge & YOLO Multi-Model AI Tag */}
      <View style={styles.topHud} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.modeBadge}
          onPress={onToggleFeedMode}
          activeOpacity={0.8}
        >
          <Ionicons
            name={feedMode === 'model_video' ? 'videocam' : 'camera'}
            size={12}
            color="#fff"
          />
          <Text style={styles.modeBadgeText}>
            {feedMode === 'model_video' ? 'MODEL DETECTION FEED (LOOPING)' : 'LIVE CAMERA'}
          </Text>
          {onToggleFeedMode && (
            <Ionicons name="swap-horizontal" size={12} color="rgba(255,255,255,0.7)" />
          )}
        </TouchableOpacity>

        <View style={styles.aiPill}>
          <View style={styles.aiDot} />
          <Text style={styles.aiPillText}>ACCURATE YOLO · 5 CLASSES</Text>
        </View>
      </View>

      {/* Center-Bottom Prominent Real-Time Vibration & Defect Radar HUD */}
      <View style={styles.bottomHud} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.vibrationCard,
            isHighVibration
              ? styles.vibrationCardHigh
              : isModerateVibration
              ? styles.vibrationCardModerate
              : styles.vibrationCardLow,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.vibrationHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={
                  isHighVibration
                    ? 'alert-circle'
                    : isModerateVibration
                    ? 'warning'
                    : 'shield-checkmark'
                }
                size={16}
                color={
                  isHighVibration
                    ? '#EF4444'
                    : isModerateVibration
                    ? '#F59E0B'
                    : '#10B981'
                }
              />
              <Text
                style={[
                  styles.vibrationTitle,
                  {
                    color: isHighVibration
                      ? '#EF4444'
                      : isModerateVibration
                      ? '#F59E0B'
                      : '#10B981',
                  },
                ]}
              >
                {isHighVibration
                  ? 'HIGH VIBRATION · ROAD DISTRESS'
                  : isModerateVibration
                  ? 'MODERATE VIBRATION · UNEVEN ROAD'
                  : 'LOW VIBRATION · SMOOTH RIDE'}
              </Text>
            </View>

            <View style={styles.rmsBadge}>
              <Text style={styles.rmsBadgeText}>
                {vibrationRms.toFixed(2)}G RMS
              </Text>
            </View>
          </View>

          {/* Real-Time Sensor Telemetry Meters */}
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>DYNAMIC SHOCK</Text>
              <Text style={styles.telemetryValue}>
                {dynamicGForce.toFixed(2)}G
              </Text>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>VERTICAL G</Text>
              <Text style={styles.telemetryValue}>
                {verticalGForce.toFixed(2)}G
              </Text>
            </View>

            <View style={styles.telemetryDivider} />

            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryLabel}>ROAD SCAN</Text>
              <Text
                style={[
                  styles.telemetryValue,
                  {
                    color: isHighVibration
                      ? '#EF4444'
                      : isModerateVibration
                      ? '#F59E0B'
                      : '#10B981',
                  },
                ]}
              >
                {isHighVibration
                  ? 'POTHOLES / CRACKS'
                  : isModerateVibration
                  ? 'ROUGH PATCH'
                  : 'GOOD SURFACE'}
              </Text>
            </View>
          </View>

          {/* Dynamic Vibration Energy Bar */}
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${Math.min(100, Math.round((vibrationRms / 0.40) * 100))}%`,
                  backgroundColor: isHighVibration
                    ? '#EF4444'
                    : isModerateVibration
                    ? '#F59E0B'
                    : '#10B981',
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  topHud: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
  },
  aiPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  bottomHud: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    zIndex: 10,
  },
  vibrationCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  vibrationCardHigh: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(24, 10, 10, 0.92)',
  },
  vibrationCardModerate: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(24, 20, 10, 0.92)',
  },
  vibrationCardLow: {
    borderColor: 'rgba(16, 185, 129, 0.6)',
    backgroundColor: 'rgba(10, 24, 18, 0.92)',
  },
  vibrationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vibrationTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  rmsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rmsBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  telemetryItem: {
    alignItems: 'center',
    flex: 1,
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  telemetryDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  meterTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
});
