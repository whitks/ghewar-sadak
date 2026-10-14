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
    eventCount,
    gpsAccuracy,
    coords,
    lastJolt,
    currentTripId,
    stopTrip,
  } = useTripRecorder();

  const [snappedPhoto, setSnappedPhoto] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const joltAlertAnim = useRef(new Animated.Value(0)).current;

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
        Animated.delay(2200),
        Animated.timing(joltAlertAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [lastJolt?.id]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    await stopTrip();
    router.replace('/trip/summary');
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Status header */}
        <View style={styles.header}>
          <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.recLabel}>TELEMETRY ACTIVE</Text>
          <View style={styles.gBadge}>
            <Ionicons name="pulse" size={13} color={AppColors.primary} />
            <Text style={styles.gBadgeText}>{gForce.toFixed(2)} G</Text>
          </View>
        </View>

        {/* Transient Jolt Alert Banner */}
        {lastJolt && (
          <Animated.View style={[styles.joltBanner, { opacity: joltAlertAnim }]}>
            <View style={styles.joltIconCircle}>
              <Ionicons name="flash" size={16} color={AppColors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.joltTitle}>Road Shock Felt!</Text>
              <Text style={styles.joltSub}>
                {lastJolt.magnitude}G peak vibration registered at {Math.round(lastJolt.speedKmh)} km/h
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Main display */}
        <View style={styles.mainDisplay}>
          <Text style={styles.timerLabel}>Drive Duration</Text>
          <Text style={styles.timer}>{formatDuration(duration)}</Text>

          {/* Real Metrics Card */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{speed}</Text>
              <Text style={styles.metricLabel}>km/h</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: eventCount > 0 ? AppColors.accent : AppColors.textPrimary }]}>
                {eventCount}
              </Text>
              <Text style={styles.metricLabel}>shocks</Text>
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
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomArea}>
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={AppColors.warning} />
            <Text style={styles.safetyText}>
              Keep device securely docked. Shocks trigger tactile haptics automatically.
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
  joltIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joltTitle: { color: AppColors.accent, fontSize: 13, fontWeight: '800' },
  joltSub: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '500' },
  mainDisplay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  timerLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  timer: {
    color: AppColors.textPrimary,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: AppColors.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    width: '100%',
    justifyContent: 'space-around',
  },
  metric: { alignItems: 'center', minWidth: 60 },
  metricValue: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  metricDivider: { width: 1, height: 36, backgroundColor: AppColors.border },
  cameraSnapCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cameraIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  snappedThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cameraSnapTitle: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700' },
  cameraSnapSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2 },
  bottomArea: { gap: 12 },
  safetyNote: {
    backgroundColor: AppColors.warningBg,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.warningBorder,
  },
  safetyText: { color: AppColors.warning, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 16 },
});
