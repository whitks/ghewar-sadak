import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { MOCK_HAZARDS, Hazard } from '../../services/mockData';
import { HazardCard } from '../../components/HazardCard';
import { useUploadQueue } from '../../hooks/useUploadQueue';
import { useTripRecorder } from '../../hooks/useTripRecorder';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { dashcamService, DashcamPipelineState } from '../../services/dashcamService';

export default function HomeScreen() {
  const { isRecording, startTrip, stopTrip, gpsAccuracy, speed } = useTripRecorder();
  const { pendingCount } = useUploadQueue();
  const [gpsReady, setGpsReady] = useState(false);
  const [accelReady, setAccelReady] = useState(false);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [dashcamState, setDashcamState] = useState<DashcamPipelineState>(
    dashcamService.getState(),
  );
  const [hazardsList, setHazardsList] = useState<Hazard[]>(MOCK_HAZARDS.slice(0, 4));

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
    const unsub = dashcamService.subscribe((s) => {
      if (mounted) {
        setDashcamState(s);
        setHazardsList([...MOCK_HAZARDS.slice(0, 4)]);
      }
    });
    return () => {
      mounted = false;
      unsub();
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => router.push('/dashcam-pipeline')}
            >
              <Ionicons name="videocam-outline" size={20} color={AppColors.primary} />
            </TouchableOpacity>
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

        {/* WiFi Dashcam 10s Extraction Card */}
        <TouchableOpacity
          style={styles.dashcamCard}
          onPress={() => router.push('/dashcam-pipeline')}
          activeOpacity={0.9}
        >
          <View style={styles.dashcamHeaderRow}>
            <View style={styles.dashcamTitleBox}>
              <View style={styles.dashcamIconCircle}>
                <Ionicons name="videocam" size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.dashcamTitle}>WiFi Dashcam AI Pipeline</Text>
                <Text style={styles.dashcamSubtitle}>
                  {dashcamState.wifiSSID} · Continuous Video & 10s Slicing
                </Text>
              </View>
            </View>

            <View style={styles.dashcamStatusBadge}>
              <View
                style={[
                  styles.dashcamDot,
                  {
                    backgroundColor:
                      dashcamState.stage === 'completed'
                        ? AppColors.success
                        : dashcamState.stage === 'idle'
                        ? AppColors.info
                        : AppColors.accent,
                  },
                ]}
              />
              <Text style={styles.dashcamStatusBadgeText}>
                {dashcamState.stage === 'idle'
                  ? 'READY'
                  : dashcamState.stage === 'completed'
                  ? 'SYNCED'
                  : 'ACTIVE'}
              </Text>
            </View>
          </View>

          {/* Mini Flow Pipeline Stepper */}
          <View style={styles.dashcamMiniFlow}>
            <View style={styles.miniStep}>
              <Ionicons name="videocam-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>Dashcam</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="film-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>10s Slicing</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="hardware-chip-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>AI Detect</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="analytics-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>Dashboard</Text>
            </View>
          </View>

          {/* Dynamic Summary */}
          <Text style={styles.dashcamSummaryText}>
            {dashcamState.stage === 'completed'
              ? `✓ Sliced ${dashcamState.stats.totalFramesExtracted} keyframes (every 10s) · Found ${dashcamState.stats.totalPotholesFound} road defects (Peak ${dashcamState.stats.highestConfidence}% conf)`
              : dashcamState.stage === 'recording'
              ? `● Recording in progress (${dashcamState.elapsedRecordingSec}s / 30s) · Auto-extracting frames every 10s...`
              : dashcamState.stage === 'detecting'
              ? `⚡ AI Inference Engine analyzing keyframes on backend...`
              : `Records road footage continuously & transmits only 10s keyframes to save 98% bandwidth.`}
          </Text>

          {/* Button CTA */}
          <View style={styles.dashcamCtaRow}>
            <View style={styles.dashcamCtaBtn}>
              <Text style={styles.dashcamCtaText}>Open Live Pipeline</Text>
              <Ionicons name="chevron-forward" size={13} color="#ffffff" />
            </View>
            <TouchableOpacity
              style={styles.dashcamSimBtn}
              onPress={(e) => {
                e.stopPropagation();
                router.push('/dashcam-pipeline');
                setTimeout(() => {
                  dashcamService.runPipelineSimulation({
                    recordingDurationSec: 30,
                    speedMultiplier: 5,
                  });
                }, 300);
              }}
            >
              <Ionicons name="flash" size={12} color={AppColors.primary} />
              <Text style={styles.dashcamSimText}>Simulate Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

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

        {hazardsList.map((h) => (
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
  dashcamCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  dashcamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashcamTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dashcamIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashcamTitle: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  dashcamSubtitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  dashcamStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  dashcamDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dashcamStatusBadgeText: {
    color: AppColors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  dashcamMiniFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  miniStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStepText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  dashcamSummaryText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 16,
    fontWeight: '600',
  },
  dashcamCtaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dashcamCtaBtn: {
    flex: 2,
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dashcamCtaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  dashcamSimBtn: {
    flex: 1,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  dashcamSimText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
