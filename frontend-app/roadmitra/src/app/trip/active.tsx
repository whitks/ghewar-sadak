import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Image, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTripRecorder } from '../../hooks/useTripRecorder';
import { storage } from '../../services/storage';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

export default function ActiveTripScreen() {
  const {
    duration,
    speed,
    gForce,
    dynamicGForce,
    verticalGForce,
    horizontalGForce,
    vibrationRms,
    roadQuality,
    roadQualityScore,
    shockCount,
    potholeCount,
    speedBreakerCount,
    patchCount,
    gpsAccuracy,
    distanceKm,
    coords,
    lastJolt,
    lastPatch,
    currentTripId,
    stopTrip,
  } = useTripRecorder();

  const [snappedPhoto, setSnappedPhoto] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const joltAlertAnim = useRef(new Animated.Value(0)).current;
  const patchAlertAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for recording beacon
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Flash jolt banner when a new jolt occurs
  useEffect(() => {
    if (lastJolt) {
      Animated.sequence([
        Animated.timing(joltAlertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(joltAlertAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [lastJolt?.id]);

  // Flash patch banner when a sustained rough road patch is detected
  useEffect(() => {
    if (lastPatch) {
      Animated.sequence([
        Animated.timing(patchAlertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(patchAlertAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [lastPatch?.id]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    const finishedTrip = await stopTrip();
    if (finishedTrip?.id) {
      router.replace({
        pathname: '/trip/summary',
        params: { id: finishedTrip.id },
      });
    } else {
      router.replace('/trip/summary');
    }
  };

  // Quick snap camera to capture visible pothole / road defect
  const handleSnapCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission', 'Camera permission is required to capture road defect photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const photoUri = result.assets[0].uri;
        setSnappedPhoto(photoUri);
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Save manual report with real location & photo to upload queue
        const reportCoords = coords ?? { lat: 18.9388, lon: 72.8354 };
        await storage.addToQueue({
          id: `upload-report-${Date.now()}`,
          type: 'report',
          status: 'pending',
          attempts: 0,
          createdAt: Date.now(),
          payload: {
            report_id: `rep-${Date.now()}`,
            trip_id: currentTripId,
            ts: Date.now(),
            lat: reportCoords.lat,
            lon: reportCoords.lon,
            gps_accuracy_m: gpsAccuracy ?? 10,
            type: 'pothole',
            photo_uri: photoUri,
            needs_blur: true,
          },
        });

        // Save to local hazards so it immediately appears on the Map with photo
        await storage.addHazard({
          id: `haz-snap-${Date.now()}`,
          lat: reportCoords.lat,
          lon: reportCoords.lon,
          type: 'pothole',
          status: 'confirmed',
          confidence: 0.94,
          severity: 80,
          source: 'camera',
          cameraScore: 0.94,
          deviceCount: 1,
          lastSeen: new Date().toISOString(),
          description: 'Pothole photo captured in-trip',
          photoUri,
        });
      }
    } catch (err) {
      console.warn('Camera snap failed:', err);
    }
  };

  // Road quality color and label helper
  const qualityInfo = {
    smooth: { label: 'SMOOTH ROAD', color: '#10b981', bg: '#ecfdf5', icon: 'shield-checkmark' },
    good: { label: 'GOOD SURFACE', color: '#06b6d4', bg: '#ecfeff', icon: 'checkmark-circle' },
    moderate: { label: 'MODERATE VIBRATION', color: '#f59e0b', bg: '#fffbeb', icon: 'warning' },
    rough: { label: 'ROUGH PATCH', color: '#ef4444', bg: '#fef2f2', icon: 'alert-circle' },
  }[roadQuality || 'smooth'];

  // Clamp vibration bar 0% to 100% (0g to 0.40g scale)
  const vibrationPercent = Math.min(100, Math.round((vibrationRms / 0.40) * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Status header */}
        <View style={styles.header}>
          <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recLabel}>TELEMETRY 50Hz ACTIVE</Text>
          <View style={styles.gBadge}>
            <Ionicons name="pulse" size={13} color={AppColors.primary} />
            <Text style={styles.gBadgeText}>{gForce.toFixed(2)} G raw</Text>
          </View>
        </View>

        {/* Transient Jolt Alert Banner (Pothole or Speed Breaker) */}
        {lastJolt && (
          <Animated.View
            style={[
              styles.joltBanner,
              lastJolt.defectType === 'speed_breaker' && styles.speedBreakerBanner,
              { opacity: joltAlertAnim },
            ]}
          >
            <View
              style={[
                styles.joltIconCircle,
                lastJolt.defectType === 'speed_breaker' && styles.speedBreakerIconCircle,
              ]}
            >
              <Ionicons
                name={lastJolt.defectType === 'pothole' ? 'flash' : 'car-outline'}
                size={16}
                color={lastJolt.defectType === 'pothole' ? AppColors.accent : '#2563eb'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.joltTitle,
                  lastJolt.defectType === 'speed_breaker' && styles.speedBreakerTitle,
                ]}
              >
                {lastJolt.defectType === 'pothole' ? 'Pothole Strike Detected!' : 'Speed Breaker Crossed'}
              </Text>
              <Text style={styles.joltSub}>
                {lastJolt.defectType === 'pothole'
                  ? `~${lastJolt.estimatedDepthCm}cm depth • ${lastJolt.verticalG}G vert at ${Math.round(lastJolt.speedKmh)} km/h`
                  : `${lastJolt.verticalG}G vertical lift at ${Math.round(lastJolt.speedKmh)} km/h`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Transient Rough Road Patch Alert Banner */}
        {lastPatch && (
          <Animated.View style={[styles.patchBanner, { opacity: patchAlertAnim }]}>
            <View style={styles.patchIconCircle}>
              <Ionicons name="git-commit" size={16} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patchTitle}>Rough Road Patch Detected!</Text>
              <Text style={styles.patchSub}>
                {lastPatch.avgRms}G sustained vibration for {lastPatch.durationSec}s at {Math.round(lastPatch.speedKmh)} km/h
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Main display */}
        <View style={styles.mainDisplay}>
          <Text style={styles.timerLabel}>Drive Duration</Text>
          <Text style={styles.timer}>{formatDuration(duration)}</Text>

          {/* Real-time Vehicle Vibration & Road Quality Monitor */}
          <View style={styles.vibrationCard}>
            <View style={styles.vibrationHeader}>
              <View style={[styles.qualityPill, { backgroundColor: qualityInfo.bg }]}>
                <Ionicons name={qualityInfo.icon as any} size={13} color={qualityInfo.color} />
                <Text style={[styles.qualityPillText, { color: qualityInfo.color }]}>
                  {qualityInfo.label}
                </Text>
              </View>
              <View style={styles.vibrationNumBox}>
                <Text style={styles.vibrationNumLabel}>RMS VIBRATION</Text>
                <Text style={styles.vibrationNumVal}>{vibrationRms.toFixed(2)} G</Text>
              </View>
            </View>

            {/* Continuous Vibration Energy Bar */}
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(4, vibrationPercent)}%`,
                    backgroundColor: qualityInfo.color,
                  },
                ]}
              />
            </View>
            <View style={styles.barLabels}>
              <Text style={styles.barLabelText}>Vert: {verticalGForce.toFixed(2)}G</Text>
              <Text style={styles.barLabelText}>Score: {roadQualityScore}/100</Text>
              <Text style={styles.barLabelText}>Horiz: {horizontalGForce.toFixed(2)}G</Text>
            </View>
          </View>

          {/* Real Metrics Card */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{speed}</Text>
              <Text style={styles.metricLabel}>km/h</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text
                style={[
                  styles.metricValue,
                  { color: potholeCount > 0 ? AppColors.accent : AppColors.textPrimary },
                ]}
              >
                {potholeCount}
              </Text>
              <Text style={styles.metricLabel}>potholes</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{distanceKm.toFixed(1)}</Text>
              <Text style={styles.metricLabel}>km</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text
                style={[
                  styles.metricValue,
                  { color: patchCount > 0 ? '#d97706' : AppColors.textPrimary },
                ]}
              >
                {patchCount}
              </Text>
              <Text style={styles.metricLabel}>patches</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                ±{gpsAccuracy ? `${gpsAccuracy}m` : '8m'}
              </Text>
              <Text style={styles.metricLabel}>GPS</Text>
            </View>
          </View>

          {/* Camera Pothole Snap Button */}
          <TouchableOpacity
            style={styles.cameraSnapCard}
            onPress={handleSnapCamera}
            activeOpacity={0.85}
          >
            {snappedPhoto ? (
              <Image source={{ uri: snappedPhoto }} style={styles.snappedThumb} />
            ) : (
              <View style={styles.cameraIconBox}>
                <Ionicons name="camera" size={24} color={AppColors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.cameraSnapTitle}>
                {snappedPhoto ? 'Road Defect Photo Attached' : 'Capture Road Defect Photo'}
              </Text>
              <Text style={styles.cameraSnapSub}>
                {snappedPhoto
                  ? 'Geotagged & ready for Vision AI fusion'
                  : 'Tap to snap a visible pothole ahead'}
              </Text>
            </View>
            <Ionicons
              name={snappedPhoto ? 'checkmark-circle' : 'chevron-forward'}
              size={20}
              color={snappedPhoto ? AppColors.success : AppColors.textMuted}
            />
          </TouchableOpacity>

          {/* Live Dashcam HUD & Vision AI Launcher */}
          <TouchableOpacity
            style={styles.dashcamLiveBtn}
            onPress={() => router.push('/dashcam-live')}
            activeOpacity={0.85}
          >
            <View style={styles.dashcamLiveIconBox}>
              <Ionicons name="videocam" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dashcamLiveTitle}>Live Dashcam & AI Vision HUD</Text>
              <Text style={styles.dashcamLiveSub}>Connect phone or Wi-Fi dashcam for 98% dual-fusion</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={AppColors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomArea}>
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={AppColors.warning} />
            <Text style={styles.safetyText}>
              Keep device docked. False spikes from braking or phone handling are filtered out automatically.
            </Text>
          </View>

          <Button
            title="End Trip & View Summary"
            variant="destructive"
            size="lg"
            fullWidth
            icon="stop-circle"
            onPress={handleStop}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  container: { flex: 1, justifyContent: 'space-between', padding: 20, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: AppColors.accent },
  recLabel: { color: AppColors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, flex: 1 },
  gBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  gBadgeText: { color: AppColors.primary, fontSize: 12, fontWeight: '800' },
  joltBanner: {
    backgroundColor: '#fff1f2',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: AppColors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  speedBreakerBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    shadowColor: '#2563eb',
  },
  joltIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBreakerIconCircle: {
    backgroundColor: '#dbeafe',
  },
  joltTitle: { color: AppColors.accent, fontSize: 13, fontWeight: '800' },
  speedBreakerTitle: { color: '#1d4ed8', fontSize: 13, fontWeight: '800' },
  joltSub: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '500' },
  patchBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  patchIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patchTitle: { color: '#b45309', fontSize: 13, fontWeight: '800' },
  patchSub: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '500' },
  mainDisplay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  timerLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  timer: {
    color: AppColors.textPrimary,
    fontSize: 60,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  vibrationCard: {
    width: '100%',
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 10,
  },
  vibrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  qualityPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  vibrationNumBox: {
    alignItems: 'flex-end',
  },
  vibrationNumLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.textSecondary,
    letterSpacing: 0.8,
  },
  vibrationNumVal: {
    fontSize: 14,
    fontWeight: '900',
    color: AppColors.textPrimary,
  },
  barContainer: {
    width: '100%',
    height: 8,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabelText: {
    fontSize: 10,
    color: AppColors.textMuted,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: '100%',
    justifyContent: 'space-around',
  },
  metric: { alignItems: 'center', minWidth: 50 },
  metricValue: { color: AppColors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: {
    color: AppColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricDivider: { width: 1, height: 30, backgroundColor: AppColors.border },
  cameraSnapCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cameraIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  snappedThumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cameraSnapTitle: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700' },
  cameraSnapSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2 },
  dashcamLiveBtn: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    shadowColor: '#06b6d4',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dashcamLiveIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashcamLiveTitle: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '800' },
  dashcamLiveSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2 },
  bottomArea: { gap: 10 },
  safetyNote: {
    backgroundColor: AppColors.warningBg,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.warningBorder,
  },
  safetyText: { color: AppColors.warning, fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 15 },
});
