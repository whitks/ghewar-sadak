import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTripRecorder } from '../../hooks/useTripRecorder';
import { storage } from '../../services/storage';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { annotateFrame, PotholeDetection, BACKEND_URL } from '../../services/api';
import { HazardType } from '../../constants/hazardTypes';
import {
  webcamStreamService,
  WebcamServiceState,
} from '../../services/webcamStreamService';
import {
  sensorFusionService,
  FusedEvent,
} from '../../services/sensorFusionService';
import { UnifiedFusionResultCard } from '../../components/UnifiedFusionResultCard';

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
  const [annotatedPhotoUrl, setAnnotatedPhotoUrl] = useState<string | null>(null);
  const [aiDetections, setAiDetections] = useState<PotholeDetection[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [streamState, setStreamState] = useState<WebcamServiceState>(
    webcamStreamService.getState(),
  );
  const [latestFusedEvent, setLatestFusedEvent] = useState<FusedEvent | null>(
    sensorFusionService.getLatestFusedEvent(),
  );

  const cameraRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // Subscribe to webcam stream service
  useEffect(() => {
    const unsub = webcamStreamService.subscribe((s) => {
      setStreamState(s);
    });
    return unsub;
  }, []);

  // Subscribe to real-time unified sensor fusion events
  useEffect(() => {
    const unsub = sensorFusionService.subscribe((event) => {
      setLatestFusedEvent(event);
      if (event.source === 'both') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    });
    return unsub;
  }, []);

  // Periodic frame grabber: takes a photo every 3s and sends it to the hosted backend model
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    if (permission?.granted) {
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
      }, 3000);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [permission?.granted]);

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

        setIsAiProcessing(true);
        setAiMessage('Running Fast YOLO AI detection...');

        // ── Call Real-Time Fast Endpoint: /api/annotate-frame?model=fast&conf=0.15 ──
        let fastDetections: PotholeDetection[] = [];
        let finalAnnotatedUrl = photoUri;
        try {
          const aiRes = await annotateFrame(photoUri, 'fast', 0.15, false);
          if (aiRes && aiRes.detections) {
            fastDetections = aiRes.detections;
            setAiDetections(fastDetections);
            if (aiRes.annotated_image_url) {
              finalAnnotatedUrl = `${BACKEND_URL}${aiRes.annotated_image_url}`;
            } else if (aiRes.annotated_image_base64) {
              finalAnnotatedUrl = aiRes.annotated_image_base64;
            }
            setAnnotatedPhotoUrl(finalAnnotatedUrl);
            setAiMessage(
              `Fast AI (${aiRes.inference_ms}ms): ${aiRes.potholes_found} defect(s) detected`
            );
          }
        } catch (aiErr) {
          console.warn('Fast AI annotation failed:', aiErr);
        } finally {
          setIsAiProcessing(false);
        }

        const reportCoords = coords ?? { lat: 18.9388, lon: 72.8354 };
        const primaryDefect = fastDetections[0];
        const defectSeverity = primaryDefect
          ? primaryDefect.severity === 'Critical'
            ? 90
            : primaryDefect.severity === 'High'
            ? 75
            : 50
          : 70;
        const defectDepth = primaryDefect?.estimated_depth_cm ?? 4.5;
        const defectClass = primaryDefect?.class_name ?? 'pothole';
        const hazardType: HazardType = defectClass.toLowerCase().includes('alligator')
          ? 'alligator_crack'
          : defectClass.toLowerCase().includes('longitudinal')
          ? 'longitudinal_crack'
          : defectClass.toLowerCase().includes('transverse')
          ? 'transverse_crack'
          : defectClass.toLowerCase().includes('other')
          ? 'rough_patch'
          : 'pothole';

        // Save manual report with real location & photo to upload queue
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
            type: hazardType,
            photo_uri: finalAnnotatedUrl,
            needs_blur: true,
          },
        });

        // Save to local hazards so it immediately appears on the Map with photo and AI metrics
        await storage.addHazard({
          id: `haz-snap-${Date.now()}`,
          lat: reportCoords.lat,
          lon: reportCoords.lon,
          type: hazardType,
          status: 'confirmed',
          confidence: primaryDefect?.confidence ?? 0.88,
          severity: defectSeverity,
          source: 'camera',
          cameraScore: primaryDefect?.confidence ?? 0.88,
          deviceCount: 1,
          lastSeen: new Date().toISOString(),
          description: `Fast AI: ${defectClass} (~${defectDepth}cm) detected in drive`,
          photoUri: finalAnnotatedUrl,
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.recLabel}>DRIVE ACTIVE · 50Hz IMU</Text>
          </View>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={12} color={AppColors.textSecondary} />
            <Text style={styles.timerText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* Live Camera Viewfinder (clean video feed — no bounding boxes over video) */}
        <View style={styles.viewfinderContainer}>
          {permission?.granted ? (
            <>
              <CameraView
                ref={cameraRef}
                facing="back"
                style={styles.cameraView}
              />

              {/* Viewfinder HUD Overlays */}
              <View style={styles.hudOverlay} pointerEvents="box-none">
                <View style={styles.hudPill}>
                  <View style={styles.hudDotLive} />
                  <Text style={styles.hudPillText}>WINDSHIELD CAM</Text>
                </View>
                <View style={styles.hudPill}>
                  <Text style={styles.hudPillText}>{vibrationRms.toFixed(2)}G RMS</Text>
                </View>
              </View>

              {streamState.isProcessingFrame && (
                <View style={styles.aiBadge}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.aiBadgeText}>SENDING TO BACKEND MODEL...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.cameraPermissionBox}>
              <Ionicons name="camera-outline" size={38} color={AppColors.primary} />
              <Text style={styles.permTitle}>Windshield Camera Inactive</Text>
              <Text style={styles.permSub}>
                Enable camera to stream road frames to backend AI model.
              </Text>
              <Button
                title="Enable Camera Scan"
                size="sm"
                onPress={requestPermission}
              />
            </View>
          )}
        </View>

        {/* Single Unified Multi-Modal Result Card (Camera + Vibration Together) */}
        <UnifiedFusionResultCard
          latestFusedEvent={latestFusedEvent}
          latestDetections={streamState.latestDetections}
          vibrationRms={vibrationRms}
          speedKmh={speed}
          roadQuality={roadQuality}
          lastError={streamState.lastError}
          isProcessingFrame={streamState.isProcessingFrame}
        />

        {/* Telemetry Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{speed}</Text>
            <Text style={styles.metricLabel}>KM/H</Text>
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
            <Text style={styles.metricLabel}>POTHOLES</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{distanceKm.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>KM</Text>
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
            <Text style={styles.metricLabel}>PATCHES</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              ±{gpsAccuracy ? `${gpsAccuracy}m` : '8m'}
            </Text>
            <Text style={styles.metricLabel}>GPS</Text>
          </View>

          {/* Camera Pothole Snap Button */}
          <TouchableOpacity
            style={styles.cameraSnapCard}
            onPress={handleSnapCamera}
            activeOpacity={0.85}
          >
            {annotatedPhotoUrl || snappedPhoto ? (
              <Image source={{ uri: annotatedPhotoUrl || snappedPhoto! }} style={styles.snappedThumb} />
            ) : (
              <View style={styles.cameraIconBox}>
                <Ionicons name="camera" size={24} color={AppColors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.cameraSnapTitle}>
                  {snappedPhoto ? 'Road Defect Snapped' : 'Capture Road Defect Photo'}
                </Text>
                <View style={styles.fastModelBadge}>
                  <Text style={styles.fastModelBadgeText}>FAST AI</Text>
                </View>
              </View>
              <Text style={styles.cameraSnapSub}>
                {aiMessage || (snappedPhoto
                  ? 'Geotagged & scanned with Fast YOLO'
                  : 'Tap to snap & run instant Fast AI road inspection')}
              </Text>
            </View>
            {isAiProcessing ? (
              <ActivityIndicator size="small" color={AppColors.primary} />
            ) : (
              <Ionicons
                name={snappedPhoto ? 'checkmark-circle' : 'chevron-forward'}
                size={20}
                color={snappedPhoto ? AppColors.success : AppColors.textMuted}
              />
            )}
          </TouchableOpacity>

          {/* AI Defect Results Banner */}
          {aiDetections.length > 0 && (
            <View style={styles.aiResultBar}>
              <Ionicons name="sparkles" size={15} color={AppColors.accent} />
              <Text style={styles.aiResultText}>
                {aiDetections[0].class_name} ({Math.round(aiDetections[0].confidence * 100)}%) · ~{aiDetections[0].estimated_depth_cm}cm depth ({aiDetections[0].severity})
              </Text>
            </View>
          )}

          {/* Live Dashcam HUD & Vision AI Launcher */}
          <TouchableOpacity
            style={styles.dashcamLiveBtn}
            onPress={() => router.push('/dashcam-pipeline')}
            activeOpacity={0.85}
          >
            <View style={styles.dashcamLiveIconBox}>
              <Ionicons name="videocam" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dashcamLiveTitle}>Live Dashcam Drive Mode (Fast AI)</Text>
              <Text style={styles.dashcamLiveSub}>Real-time camera frame stream with 15ms YOLO inference</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={AppColors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Link to Fullscreen Dashcam HUD if desired */}
        <TouchableOpacity
          style={styles.fullscreenHudBtn}
          onPress={() => router.push('/dashcam-live')}
          activeOpacity={0.85}
        >
          <Ionicons name="expand-outline" size={16} color={AppColors.primary} />
          <Text style={styles.fullscreenHudBtnText}>Open Fullscreen HUD & Dashcam Settings</Text>
        </TouchableOpacity>

        {/* Stop Trip Button */}
        <View style={styles.bottomArea}>
          <Button
            title="End Trip & View Summary"
            variant="destructive"
            size="lg"
            fullWidth
            icon="stop-circle"
            onPress={handleStop}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.accent,
  },
  recLabel: {
    color: AppColors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  viewfinderContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  cameraView: {
    flex: 1,
  },
  hudOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hudDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.success,
  },
  hudPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aiBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cameraPermissionBox: {
    flex: 1,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  permSub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    justifyContent: 'space-around',
  },
  metric: { alignItems: 'center', minWidth: 50 },
  metricValue: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: AppColors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  metricDivider: { width: 1, height: 26, backgroundColor: AppColors.border },
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
  fullscreenHudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  fullscreenHudBtnText: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  bottomArea: {
    marginTop: 4,
  },
  safetyText: { color: AppColors.warning, fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 15 },
  fastModelBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  fastModelBadgeText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aiResultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff1f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
    width: '100%',
  },
  aiResultText: {
    color: AppColors.accent,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
