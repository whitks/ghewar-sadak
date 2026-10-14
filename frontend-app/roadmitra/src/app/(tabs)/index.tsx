import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { MOCK_HAZARDS } from '../../services/mockData';
import { HazardCard } from '../../components/HazardCard';
import { useUploadQueue } from '../../hooks/useUploadQueue';
import { useTripRecorder } from '../../hooks/useTripRecorder';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

export default function HomeScreen() {
  const { isRecording, startTrip, stopTrip, gpsAccuracy, speed } = useTripRecorder();
  const { pendingCount } = useUploadQueue();
  const [gpsReady, setGpsReady] = useState(false);
  const [accelReady, setAccelReady] = useState(false);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);

  const recentHazards = MOCK_HAZARDS.slice(0, 3);

  // Check initial real sensor status
  useEffect(() => {
    let mounted = true;
    async function checkSensors() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          if (mounted) setGpsReady(true);
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
          if (mounted && loc?.coords.accuracy) {
            setLiveAccuracy(Math.round(loc.coords.accuracy));
          }
        }
      } catch {}

      try {
        const available = await Accelerometer.isAvailableAsync();
        if (mounted) setAccelReady(available);
      } catch {
        if (mounted) setAccelReady(true);
      }
    }
    checkSensors();
    return () => {
      mounted = false;
    };
  }, []);

  const handleTripToggle = async () => {
    if (isRecording) {
      await stopTrip();
      router.push('/trip/summary');
    } else {
      await startTrip();
      router.push('/trip/active');
    }
  };

  const accuracyDisplay = gpsAccuracy ?? liveAccuracy ?? 12;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="shield-checkmark" size={18} color={AppColors.surface} />
              </View>
              <Text style={styles.greeting}>RoadPulse</Text>
            </View>
            <Text style={styles.subtitle}>Road safety telemetry & defect detection</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color={AppColors.textPrimary} />
            {pendingCount > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifCount}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Trip Status Card */}
        <View style={[styles.recordingCard, isRecording && styles.recordingActive]}>
          <View style={styles.recordingInfo}>
            <View style={[styles.recDot, isRecording && styles.recDotActive]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.recStatus}>
                {isRecording ? 'Active Trip Recording' : 'Ready to Monitor Road'}
              </Text>
              <Text style={styles.recSubStatus}>
                {isRecording
                  ? `Speed: ${speed} km/h · Accelerometer jolt detection active`
                  : 'Start a drive to automatically record road surface shocks & hazards'}
              </Text>
            </View>
          </View>

          <Button
            title={isRecording ? 'Stop Recording Trip' : 'Start Drive Mode'}
            variant={isRecording ? 'destructive' : 'primary'}
            size="lg"
            fullWidth
            icon={isRecording ? 'stop-circle' : 'play-circle'}
            onPress={handleTripToggle}
          />
        </View>

        {/* Real Sensor Telemetry Bar */}
        <View style={styles.sensorRow}>
          <View style={styles.sensorItem}>
            <View
              style={[
                styles.sensorDot,
                { backgroundColor: gpsReady ? AppColors.success : AppColors.warning },
              ]}
            />
            <Ionicons name="navigate-outline" size={14} color={AppColors.textSecondary} />
            <Text style={styles.sensorLabel}>GPS</Text>
            <Text style={styles.sensorValue}>±{accuracyDisplay}m</Text>
          </View>

          <View style={styles.sensorItem}>
            <View
              style={[
                styles.sensorDot,
                { backgroundColor: accelReady ? AppColors.success : AppColors.warning },
              ]}
            />
            <Ionicons name="pulse-outline" size={14} color={AppColors.textSecondary} />
            <Text style={styles.sensorLabel}>IMU</Text>
            <Text style={styles.sensorValue}>20 Hz</Text>
          </View>

          <View style={styles.sensorItem}>
            <View style={[styles.sensorDot, { backgroundColor: AppColors.success }]} />
            <Ionicons name="cloud-done-outline" size={14} color={AppColors.textSecondary} />
            <Text style={styles.sensorLabel}>Cloud</Text>
            <Text style={styles.sensorValue}>Ready</Text>
          </View>
        </View>

        {pendingCount > 0 && (
          <TouchableOpacity
            style={styles.uploadBanner}
            onPress={() => router.push('/upload-queue')}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={AppColors.primary} />
            <Text style={styles.uploadText}>{pendingCount} telemetry records waiting to upload</Text>
            <Ionicons name="chevron-forward" size={16} color={AppColors.primary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        {/* Quick Calibration / Camera Tip */}
        <TouchableOpacity
          style={styles.calibCard}
          onPress={() => router.push('/calibration')}
        >
          <View style={styles.calibIconBox}>
            <Ionicons name="phone-portrait-outline" size={20} color={AppColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calibTitle}>Phone Placement Tip</Text>
            <Text style={styles.calibSubtitle}>
              Keep phone flat or securely docked on the dashboard for accurate shock reading.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
        </TouchableOpacity>

        {/* Recent Hazards */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Corroborated Road Hazards</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.seeMapText}>View Map →</Text>
          </TouchableOpacity>
        </View>

        {recentHazards.map((h) => (
          <HazardCard
            key={h.id}
            hazard={h}
            onPress={() => router.push(`/hazard/${h.id}`)}
          />
        ))}

        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={() => router.push('/(tabs)/map')}
          activeOpacity={0.85}
        >
          <Ionicons name="map-outline" size={18} color={AppColors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.viewAllText}>Open Interactive Map</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: AppColors.textSecondary, fontSize: 13, marginTop: 2, fontWeight: '500' },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: AppColors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: AppColors.surface,
  },
  notifCount: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  recordingCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 16,
  },
  recordingActive: {
    borderColor: AppColors.accent,
    backgroundColor: '#fffcfc',
  },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: AppColors.textMuted },
  recDotActive: { backgroundColor: AppColors.accent },
  recStatus: { color: AppColors.textPrimary, fontSize: 17, fontWeight: '800' },
  recSubStatus: { color: AppColors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  sensorRow: { flexDirection: 'row', gap: 8 },
  sensorItem: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  sensorDot: { width: 7, height: 7, borderRadius: 3.5 },
  sensorLabel: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '600' },
  sensorValue: { color: AppColors.textPrimary, fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  uploadBanner: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadText: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
  calibCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calibIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calibTitle: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700' },
  calibSubtitle: { color: AppColors.textSecondary, fontSize: 11, marginTop: 1, lineHeight: 15 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  sectionTitle: { color: AppColors.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  seeMapText: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
  viewAllBtn: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: AppColors.border,
    marginTop: 4,
  },
  viewAllText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
});
