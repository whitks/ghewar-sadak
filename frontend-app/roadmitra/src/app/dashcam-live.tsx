import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { AppColors } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { useTripRecorder } from '../hooks/useTripRecorder';
import {
  webcamStreamService,
  WebcamServiceState,
  CameraSourceMode,
  POPULAR_DASHCAM_PRESETS,
} from '../services/webcamStreamService';
import {
  sensorFusionService,
  FusedEvent,
  VisualCandidate,
} from '../services/sensorFusionService';

export default function DashcamLiveScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [streamState, setStreamState] = useState<WebcamServiceState>(
    webcamStreamService.getState(),
  );
  const [recentFused, setRecentFused] = useState<FusedEvent[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [customIp, setCustomIp] = useState(streamState.cameraIP);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [connFeedback, setConnFeedback] = useState<string | null>(null);

  const { speed, gForce, vibrationRms, roadQuality } = useTripRecorder();

  const cameraRef = useRef<any>(null);
  const fusionAlertAnim = useRef(new Animated.Value(0)).current;
  const [lastFusedBanner, setLastFusedBanner] = useState<FusedEvent | null>(null);

  // Subscribe to webcam stream service
  useEffect(() => {
    const unsub = webcamStreamService.subscribe((s) => {
      setStreamState(s);
    });
    return unsub;
  }, []);

  // Subscribe to real-time sensor fusion events
  useEffect(() => {
    const unsub = sensorFusionService.subscribe((event) => {
      setRecentFused((prev) => [event, ...prev].slice(0, 10));

      if (event.source === 'both') {
        setLastFusedBanner(event);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        Animated.sequence([
          Animated.timing(fusionAlertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(2600),
          Animated.timing(fusionAlertAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }
    });
    return unsub;
  }, [fusionAlertAnim]);

  // Periodic frame grabber when using Phone Camera mode
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    if (streamState.sourceMode === 'phone_camera' && streamState.isStreaming) {
      timer = setInterval(async () => {
        if (!active || !cameraRef.current) return;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.5,
            skipProcessing: true,
          });
          if (photo?.uri && active) {
            await webcamStreamService.processCapturedPhoneFrame(photo.uri);
          }
        } catch {}
      }, 1500);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [streamState.sourceMode, streamState.isStreaming]);

  const toggleStream = () => {
    if (streamState.isStreaming) {
      webcamStreamService.stopStream();
    } else {
      webcamStreamService.startStream();
    }
  };

  const handleSelectMode = (mode: CameraSourceMode) => {
    webcamStreamService.setSourceMode(mode);
  };

  const handleSelectPreset = (presetId: string) => {
    webcamStreamService.selectPreset(presetId);
    const p = POPULAR_DASHCAM_PRESETS.find((x) => x.id === presetId);
    if (p) setCustomIp(p.defaultIP);
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnFeedback(null);
    const res = await webcamStreamService.testConnection(customIp);
    setIsTestingConn(false);
    setConnFeedback(res.message);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={AppColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Live Dashcam & AI Vision</Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: streamState.isStreaming
                    ? AppColors.success
                    : AppColors.textMuted,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {streamState.isStreaming ? 'Scanning Road Ahead' : 'Feed Paused'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => setShowConfig(!showConfig)}
        >
          <Ionicons name="settings-outline" size={20} color={AppColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Main Viewfinder Area */}
      <View style={styles.viewfinderContainer}>
        {streamState.sourceMode === 'phone_camera' ? (
          permission?.granted ? (
            <CameraView
              ref={cameraRef}
              facing="back"
              style={styles.cameraView}
            >
              {/* Overlay HUD */}
              <View style={styles.hudOverlay}>
                <View style={styles.hudPill}>
                  <Ionicons name="radio" size={12} color="#10b981" />
                  <Text style={styles.hudPillText}>Phone Windshield Cam</Text>
                </View>
                <View style={styles.hudPill}>
                  <Text style={styles.hudPillText}>{vibrationRms.toFixed(2)}G RMS</Text>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionBox}>
              <Ionicons name="camera-outline" size={44} color={AppColors.primary} />
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <Text style={styles.permissionSub}>
                To use your phone as a road-scanning dashcam, grant camera access.
              </Text>
              <Button title="Enable Camera" onPress={requestPermission} size="md" />
            </View>
          )
        ) : (
          <View style={styles.externalStreamScreen}>
            {streamState.recentVisualCandidates.length > 0 && streamState.recentVisualCandidates[0]?.photoUri ? (
              <Image
                source={{ uri: streamState.recentVisualCandidates[0].photoUri }}
                style={styles.streamImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.streamPlaceholder}>
                <Ionicons name="videocam-outline" size={48} color={AppColors.textMuted} />
                <Text style={styles.streamPlaceholderTitle}>
                  {streamState.sourceMode === 'wifi_dashcam'
                    ? 'Wi-Fi Dashcam Stream'
                    : 'External IP Camera'}
                </Text>
                <Text style={styles.streamPlaceholderSub}>
                  {streamState.streamUrl}
                </Text>
              </View>
            )}
            <View style={styles.hudOverlay}>
              <View style={styles.hudPill}>
                <Ionicons name="wifi" size={12} color="#06b6d4" />
                <Text style={styles.hudPillText}>
                  {streamState.sourceMode === 'wifi_dashcam' ? 'Wi-Fi Dashcam' : 'IP Stream'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Real-time Fused Hazard Banner (flashes when Vision + Vibration syncs!) */}
        {lastFusedBanner && (
          <Animated.View style={[styles.fusedBanner, { opacity: fusionAlertAnim }]}>
            <View style={styles.fusedIconCircle}>
              <Ionicons name="flash" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.fusedTagRow}>
                <Text style={styles.fusedBadge}>DUAL-CONFIRMED</Text>
                <Text style={styles.fusedScore}>
                  {Math.round(lastFusedBanner.fusedConfidence * 100)}% CONFIDENCE
                </Text>
              </View>
              <Text style={styles.fusedDesc}>{lastFusedBanner.description}</Text>
            </View>
          </Animated.View>
        )}

        {/* Processing Indicator */}
        {streamState.isProcessingFrame && (
          <View style={styles.aiBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.aiBadgeText}>YOLO AI ANALYZING...</Text>
          </View>
        )}
      </View>

      {/* Real-time Telemetry Strip */}
      <View style={styles.telemetryBar}>
        <View style={styles.telItem}>
          <Text style={styles.telVal}>{speed}</Text>
          <Text style={styles.telLabel}>KM/H</Text>
        </View>
        <View style={styles.telDivider} />
        <View style={styles.telItem}>
          <Text style={styles.telVal}>{vibrationRms.toFixed(2)}</Text>
          <Text style={styles.telLabel}>VIB RMS</Text>
        </View>
        <View style={styles.telDivider} />
        <View style={styles.telItem}>
          <Text style={styles.telVal}>{streamState.totalDefectsFound}</Text>
          <Text style={styles.telLabel}>DEFECTS</Text>
        </View>
        <View style={styles.telDivider} />
        <View style={styles.telItem}>
          <Text style={[styles.telVal, { color: AppColors.success }]}>
            {recentFused.filter((e) => e.source === 'both').length}
          </Text>
          <Text style={styles.telLabel}>FUSED</Text>
        </View>
      </View>

      {/* Control Buttons & Mode Selector */}
      <View style={styles.actionContainer}>
        <Button
          title={streamState.isStreaming ? 'Pause Road Scan' : 'Start Live Road Scan'}
          variant={streamState.isStreaming ? 'outline' : 'primary'}
          icon={streamState.isStreaming ? 'pause' : 'play'}
          size="lg"
          fullWidth
          onPress={toggleStream}
        />
      </View>

      {/* Configuration Drawer Modal */}
      {showConfig && (
        <View style={styles.configModal}>
          <View style={styles.configHeader}>
            <Text style={styles.configTitle}>Dashcam & Camera Source</Text>
            <TouchableOpacity onPress={() => setShowConfig(false)}>
              <Ionicons name="close-circle" size={24} color={AppColors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mode 1: Phone Windshield Camera */}
            <TouchableOpacity
              style={[
                styles.sourceOption,
                streamState.sourceMode === 'phone_camera' && styles.sourceOptionActive,
              ]}
              onPress={() => handleSelectMode('phone_camera')}
            >
              <View style={styles.sourceIconBox}>
                <Ionicons name="phone-portrait-outline" size={22} color={AppColors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>Phone Windshield Camera</Text>
                <Text style={styles.sourceSub}>
                  Mount this phone on your windshield. Zero extra hardware needed.
                </Text>
              </View>
              {streamState.sourceMode === 'phone_camera' && (
                <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
              )}
            </TouchableOpacity>

            {/* Mode 2: Wi-Fi Dashcam */}
            <TouchableOpacity
              style={[
                styles.sourceOption,
                streamState.sourceMode === 'wifi_dashcam' && styles.sourceOptionActive,
              ]}
              onPress={() => handleSelectMode('wifi_dashcam')}
            >
              <View style={styles.sourceIconBox}>
                <Ionicons name="videocam-outline" size={22} color="#06b6d4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>Car Wi-Fi Dashcam</Text>
                <Text style={styles.sourceSub}>
                  Connect to 70mai, Viofo, DDPAI, or any generic Wi-Fi dashcam.
                </Text>
              </View>
              {streamState.sourceMode === 'wifi_dashcam' && (
                <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
              )}
            </TouchableOpacity>

            {streamState.sourceMode === 'wifi_dashcam' && (
              <View style={styles.presetsBox}>
                <Text style={styles.presetLabel}>Select Dashcam Model:</Text>
                {POPULAR_DASHCAM_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.presetItem,
                      streamState.activePresetId === p.id && styles.presetItemActive,
                    ]}
                    onPress={() => handleSelectPreset(p.id)}
                  >
                    <Text style={styles.presetName}>{p.name}</Text>
                    <Text style={styles.presetDesc}>{p.defaultIP}</Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.ipInputRow}>
                  <TextInput
                    style={styles.ipInput}
                    value={customIp}
                    onChangeText={setCustomIp}
                    placeholder="192.168.1.1"
                  />
                  <TouchableOpacity
                    style={styles.testBtn}
                    onPress={handleTestConnection}
                    disabled={isTestingConn}
                  >
                    {isTestingConn ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.testBtnText}>Test IP</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {connFeedback && (
                  <Text style={styles.feedbackText}>{connFeedback}</Text>
                )}
              </View>
            )}

            {/* Mode 3: Simulation */}
            <TouchableOpacity
              style={[
                styles.sourceOption,
                streamState.sourceMode === 'simulation' && styles.sourceOptionActive,
              ]}
              onPress={() => handleSelectMode('simulation')}
            >
              <View style={styles.sourceIconBox}>
                <Ionicons name="flask-outline" size={22} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle}>Indoor Simulation Stream</Text>
                <Text style={styles.sourceSub}>
                  Cycles real road footage for testing YOLO AI when away from your car.
                </Text>
              </View>
              {streamState.sourceMode === 'simulation' && (
                <Ionicons name="checkmark-circle" size={22} color={AppColors.primary} />
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: AppColors.textPrimary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, color: AppColors.textSecondary, fontWeight: '600' },
  configBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraView: { flex: 1 },
  externalStreamScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  streamImage: { width: '100%', height: '100%' },
  streamPlaceholder: { alignItems: 'center', gap: 8 },
  streamPlaceholderTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  streamPlaceholderSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  permissionBox: {
    flex: 1,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  permissionTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textPrimary },
  permissionSub: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  hudOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hudPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  fusedBanner: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
    backgroundColor: '#064e3b',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fusedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fusedTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fusedBadge: { color: '#6ee7b7', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  fusedScore: { color: '#fff', fontSize: 11, fontWeight: '800' },
  fusedDesc: { color: '#e5e7eb', fontSize: 11, marginTop: 2 },
  aiBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37,99,235,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  telemetryBar: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: AppColors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  telItem: { alignItems: 'center', minWidth: 50 },
  telVal: { fontSize: 18, fontWeight: '900', color: AppColors.textPrimary },
  telLabel: { fontSize: 9, fontWeight: '700', color: AppColors.textSecondary, marginTop: 2 },
  telDivider: { width: 1, height: 24, backgroundColor: AppColors.border },
  actionContainer: {
    padding: 16,
    backgroundColor: AppColors.surface,
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  configModal: {
    position: 'absolute',
    top: 60,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  configTitle: { fontSize: 18, fontWeight: '800', color: AppColors.textPrimary },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 12,
    gap: 12,
  },
  sourceOptionActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.cardAlt,
  },
  sourceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitle: { fontSize: 14, fontWeight: '800', color: AppColors.textPrimary },
  sourceSub: { fontSize: 11, color: AppColors.textSecondary, marginTop: 2, lineHeight: 15 },
  presetsBox: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 14,
  },
  presetLabel: { fontSize: 12, fontWeight: '700', color: AppColors.textSecondary, marginBottom: 8 },
  presetItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetItemActive: { backgroundColor: AppColors.cardAlt },
  presetName: { fontSize: 13, fontWeight: '700', color: AppColors.textPrimary },
  presetDesc: { fontSize: 11, color: AppColors.textSecondary },
  ipInputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ipInput: {
    flex: 1,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: AppColors.border,
    color: AppColors.textPrimary,
  },
  testBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  feedbackText: { fontSize: 11, color: AppColors.primary, marginTop: 6 },
});
