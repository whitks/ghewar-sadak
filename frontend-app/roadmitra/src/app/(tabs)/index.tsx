import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator,
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
import {
  webcamStreamService,
  WebcamServiceState,
  CameraSourceMode,
  POPULAR_DASHCAM_PRESETS,
} from '../../services/webcamStreamService';

export default function HomeScreen() {
  const { isRecording, startTrip, stopTrip, gpsAccuracy, speed } = useTripRecorder();
  const { pendingCount } = useUploadQueue();
  const [gpsReady, setGpsReady] = useState(false);
  const [accelReady, setAccelReady] = useState(false);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [dashcamState, setDashcamState] = useState<DashcamPipelineState>(
    dashcamService.getState(),
  );
  const [cameraState, setCameraState] = useState<WebcamServiceState>(
    webcamStreamService.getState(),
  );
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [customIp, setCustomIp] = useState(cameraState.cameraIP);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connFeedback, setConnFeedback] = useState<string | null>(null);
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
    const unsubWebcam = webcamStreamService.subscribe((s) => {
      if (mounted) {
        setCameraState(s);
      }
    });
    return () => {
      mounted = false;
      unsub();
      unsubWebcam();
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
              onPress={() => router.push('/dashcam-live')}
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

        {/* Camera & WiFi Dashcam AI Vision Card */}
        <View style={styles.dashcamCard}>
          <View style={styles.dashcamHeaderRow}>
            <View style={styles.dashcamTitleBox}>
              <View style={styles.dashcamIconCircle}>
                <Ionicons name="videocam" size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dashcamTitle}>Camera & Dashcam Vision</Text>
                <Text style={styles.dashcamSubtitle} numberOfLines={1}>
                  {cameraState.sourceMode === 'phone_camera'
                    ? '📱 Phone Windshield Camera'
                    : cameraState.sourceMode === 'wifi_dashcam'
                    ? `📷 Wi-Fi Dashcam (${cameraState.cameraIP})`
                    : cameraState.sourceMode === 'ip_stream'
                    ? '🌐 External IP Stream'
                    : '🧪 Road Video Simulation'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.connectCameraBadge}
              onPress={() => setShowConnectModal(true)}
            >
              <Ionicons name="settings-outline" size={12} color={AppColors.primary} />
              <Text style={styles.connectCameraBadgeText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Connection Status Indicator */}
          <View style={styles.cameraStatusBar}>
            <View style={styles.cameraStatusInfo}>
              <View
                style={[
                  styles.statusPillDot,
                  { backgroundColor: cameraState.isConnected ? AppColors.success : AppColors.warning },
                ]}
              />
              <Text style={styles.cameraStatusInfoText}>
                {cameraState.isConnected ? 'Connected & Ready' : 'Awaiting Connection'}
              </Text>
            </View>
            <Text style={styles.cameraStatusSub}>
              {cameraState.sourceMode === 'phone_camera'
                ? 'Mount phone on dash'
                : cameraState.sourceMode === 'wifi_dashcam'
                ? cameraState.activePresetId.toUpperCase()
                : 'Custom feed'}
            </Text>
          </View>

          {/* Mini Flow Pipeline Stepper */}
          <View style={styles.dashcamMiniFlow}>
            <View style={styles.miniStep}>
              <Ionicons name="videocam-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>Camera</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="hardware-chip-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>YOLO AI</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="pulse-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>IMU Fusion</Text>
            </View>
            <Ionicons name="arrow-forward" size={9} color={AppColors.textMuted} />
            <View style={styles.miniStep}>
              <Ionicons name="shield-checkmark-outline" size={11} color={AppColors.textPrimary} />
              <Text style={styles.miniStepText}>98% Conf</Text>
            </View>
          </View>

          {/* Dynamic Summary */}
          <Text style={styles.dashcamSummaryText}>
            Combines live road video detection with 50Hz vehicle vibration telemetry for dual-confirmed pothole & patch tracking.
          </Text>

          {/* Dual Action CTAs: Connect Camera & Live HUD */}
          <View style={styles.dashcamCtaRow}>
            <TouchableOpacity
              style={styles.connectCamBtn}
              onPress={() => setShowConnectModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="link" size={14} color={AppColors.primary} />
              <Text style={styles.connectCamBtnText}>Connect Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashcamCtaBtn}
              onPress={() => router.push('/dashcam-live')}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={14} color="#ffffff" />
              <Text style={styles.dashcamCtaText}>Open Live HUD</Text>
              <Ionicons name="chevron-forward" size={13} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Connect Camera Modal */}
        <Modal
          visible={showConnectModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowConnectModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Connect Road Camera</Text>
                  <Text style={styles.modalSub}>Select where our YOLO model receives road video from</Text>
                </View>
                <TouchableOpacity onPress={() => setShowConnectModal(false)}>
                  <Ionicons name="close-circle" size={26} color={AppColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Option 1: Phone Windshield Camera */}
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    cameraState.sourceMode === 'phone_camera' && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    webcamStreamService.setSourceMode('phone_camera');
                  }}
                >
                  <View style={styles.modalOptionIconBox}>
                    <Ionicons name="phone-portrait-outline" size={22} color={AppColors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOptionTitle}>Phone Windshield Camera</Text>
                    <Text style={styles.modalOptionSub}>
                      Use this phone mounted on dashboard or AC vent. Zero extra hardware needed.
                    </Text>
                  </View>
                  {cameraState.sourceMode === 'phone_camera' && (
                    <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
                  )}
                </TouchableOpacity>

                {/* Option 2: Wi-Fi Car Dashcam */}
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    cameraState.sourceMode === 'wifi_dashcam' && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    webcamStreamService.setSourceMode('wifi_dashcam');
                  }}
                >
                  <View style={styles.modalOptionIconBox}>
                    <Ionicons name="videocam-outline" size={22} color="#06b6d4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOptionTitle}>Car Wi-Fi Dashcam</Text>
                    <Text style={styles.modalOptionSub}>
                      Connect to 70mai, Viofo, DDPAI, or generic Wi-Fi dashcam.
                    </Text>
                  </View>
                  {cameraState.sourceMode === 'wifi_dashcam' && (
                    <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
                  )}
                </TouchableOpacity>

                {cameraState.sourceMode === 'wifi_dashcam' && (
                  <View style={styles.dashcamModelBox}>
                    <Text style={styles.modelBoxLabel}>Select Dashcam Model:</Text>
                    {POPULAR_DASHCAM_PRESETS.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.presetRow,
                          cameraState.activePresetId === p.id && styles.presetRowActive,
                        ]}
                        onPress={() => {
                          webcamStreamService.selectPreset(p.id);
                          setCustomIp(p.defaultIP);
                        }}
                      >
                        <Text style={styles.presetNameText}>{p.name}</Text>
                        <Text style={styles.presetIpText}>{p.defaultIP}</Text>
                      </TouchableOpacity>
                    ))}

                    <View style={styles.ipTestGroup}>
                      <TextInput
                        style={styles.ipTextInput}
                        value={customIp}
                        onChangeText={setCustomIp}
                        placeholder="192.168.1.1"
                      />
                      <TouchableOpacity
                        style={styles.testIpBtn}
                        onPress={async () => {
                          setIsTestingConn(true);
                          setConnFeedback(null);
                          const res = await webcamStreamService.testConnection(customIp);
                          setIsTestingConn(false);
                          setConnFeedback(res.message);
                        }}
                        disabled={isTestingConn}
                      >
                        {isTestingConn ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.testIpBtnText}>Test IP</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {connFeedback && (
                      <Text style={styles.connFeedbackText}>{connFeedback}</Text>
                    )}
                  </View>
                )}

                {/* Option 3: Simulation */}
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    cameraState.sourceMode === 'simulation' && styles.modalOptionActive,
                  ]}
                  onPress={() => {
                    webcamStreamService.setSourceMode('simulation');
                  }}
                >
                  <View style={styles.modalOptionIconBox}>
                    <Ionicons name="flask-outline" size={22} color="#d97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOptionTitle}>Indoor Simulation Stream</Text>
                    <Text style={styles.modalOptionSub}>
                      Cycles recorded road footage for testing YOLO AI & fusion indoors.
                    </Text>
                  </View>
                  {cameraState.sourceMode === 'simulation' && (
                    <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
                  )}
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Open Live HUD & Viewfinder"
                  size="lg"
                  fullWidth
                  icon="videocam"
                  onPress={() => {
                    setShowConnectModal(false);
                    router.push('/dashcam-live');
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>

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

  // Connect Camera button (inline badge)
  connectCameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  connectCameraBadgeText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Camera status bar inside dashcam card
  cameraStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cameraStatusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cameraStatusInfoText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  cameraStatusSub: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },

  // Connect Camera main CTA button
  connectCamBtn: {
    flex: 1,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: AppColors.primary,
  },
  connectCamBtnText: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSub: {
    color: AppColors.textSecondary,
    fontSize: 13,
    marginTop: 3,
    lineHeight: 17,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    marginBottom: 10,
  },
  modalOptionActive: {
    borderColor: AppColors.primary,
    backgroundColor: `${AppColors.primary}12`,
  },
  modalOptionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  modalOptionTitle: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  modalOptionSub: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  dashcamModelBox: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  modelBoxLabel: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  presetRowActive: {
    borderColor: AppColors.primary,
    backgroundColor: `${AppColors.primary}10`,
  },
  presetNameText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  presetIpText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  ipTestGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  ipTextInput: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: AppColors.border,
    color: AppColors.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  testIpBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  testIpBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  connFeedbackText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  modalFooter: {
    marginTop: 6,
  },
});
