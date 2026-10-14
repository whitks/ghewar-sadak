import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { AppColors } from '../constants/theme';
import { DashcamWorkflow } from '../components/DashcamWorkflow';
import { BBoxOverlay } from '../components/BBoxOverlay';
import { VideoAnnotator } from '../components/VideoAnnotator';
import {
  dashcamService,
  DashcamPipelineState,
  ExtractedFrame,
} from '../services/dashcamService';
import { uploadDashcamFrame, GpsCoordinates, PotholeDetection, BACKEND_URL } from '../services/api';

type PipelineViewMode = 'camera' | 'video_annotator' | 'simulation';

export default function DashcamPipelineScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pipelineState, setPipelineState] = useState<DashcamPipelineState>(
    dashcamService.getState(),
  );
  const [viewMode, setViewMode] = useState<PipelineViewMode>('camera');
  const [activeFrameTab, setActiveFrameTab] = useState<ExtractedFrame | null>(null);

  // Live Phone Camera State
  const cameraRef = useRef<CameraView | null>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [nextCaptureSec, setNextCaptureSec] = useState(10);
  const [latestCapturedUri, setLatestCapturedUri] = useState<string | null>(null);
  const [latestDetections, setLatestDetections] = useState<PotholeDetection[]>([]);
  const [isUploadingLive, setIsUploadingLive] = useState(false);
  const [liveGps, setLiveGps] = useState<GpsCoordinates>({
    latitude: 28.6145,
    longitude: 77.2094,
    altitude: 216,
    speed: 42.0,
  });

  // Track GPS position
  useEffect(() => {
    let mounted = true;
    async function trackGps() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted && loc?.coords) {
            setLiveGps({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              altitude: loc.coords.altitude ?? 0,
              speed: (loc.coords.speed ?? 0) * 3.6, // m/s to km/h
            });
          }
        }
      } catch {}
    }
    trackGps();
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to dashcamService
  useEffect(() => {
    const unsubscribe = dashcamService.subscribe((s) => {
      setPipelineState(s);
      if (s.extractedFrames.length > 0 && !activeFrameTab) {
        setActiveFrameTab(s.extractedFrames[0]);
      }
    });
    return unsubscribe;
  }, [activeFrameTab]);

  const isUploadingRef = useRef(false);
  const liveGpsRef = useRef(liveGps);
  liveGpsRef.current = liveGps;

  /**
   * Take a real frame from the phone's camera, upload to AI server, and display bounding boxes.
   * Optimized with moderate resolution and non-blocking flags for zero preview stutter.
   */
  const captureAndDetectFrame = useCallback(async () => {
    if (!cameraRef.current || isUploadingRef.current) return;
    isUploadingRef.current = true;
    setIsUploadingLive(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        skipProcessing: true,
        shutterSound: false,
      });

      if (photo?.uri) {
        setLatestCapturedUri(photo.uri);

        const currentGps = liveGpsRef.current;
        const res = await uploadDashcamFrame(photo.uri, currentGps, 'phone_dashcam_live', 'fast', 0.15);

        if (res?.detections) {
          setLatestDetections(res.detections);

          const newFrame: ExtractedFrame = {
            id: `live-frame-${Date.now()}`,
            frameIndex: pipelineState.extractedFrames.length + 1,
            timestampSec: pipelineState.extractedFrames.length * 10,
            timestampLabel: new Date().toLocaleTimeString(),
            imageUri: photo.uri,
            status: res.detections.length > 0 ? 'detected' : 'clear',
            potholesFound: res.detections.length,
            detections: res.detections,
            annotatedImageUrl: res.annotated_image_url
              ? `${BACKEND_URL}${res.annotated_image_url}`
              : undefined,
            gps: currentGps,
          };

          setActiveFrameTab(newFrame);
        }
      }
    } catch (err: any) {
      console.warn('Camera capture / inference error:', err);
    } finally {
      isUploadingRef.current = false;
      setIsUploadingLive(false);
    }
  }, [pipelineState.extractedFrames.length]);

  // Smooth 10-Second Auto Capture Countdown
  useEffect(() => {
    if (!isAutoCapturing) {
      setNextCaptureSec(10);
      return;
    }

    setNextCaptureSec(10);
    const timer = setInterval(() => {
      setNextCaptureSec((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            captureAndDetectFrame();
          }, 0);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoCapturing, captureAndDetectFrame]);

  const handleStartSimulation = async (fastMode: boolean = false) => {
    await dashcamService.runPipelineSimulation({
      recordingDurationSec: 30,
      speedMultiplier: fastMode ? 5 : 1,
    });
  };

  const handleReset = () => {
    dashcamService.reset();
    setActiveFrameTab(null);
    setLatestCapturedUri(null);
    setLatestDetections([]);
    setIsAutoCapturing(false);
  };

  const isBusy =
    pipelineState.stage === 'recording' ||
    pipelineState.stage === 'extracting' ||
    pipelineState.stage === 'detecting';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={isBusy}
        >
          <Ionicons name="arrow-back" size={20} color={AppColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>AI Dashcam & Video Pipeline</Text>
          <View style={styles.wifiPill}>
            <Ionicons name="camera" size={12} color={AppColors.success} />
            <Text style={styles.wifiPillText}>Phone Camera & 10s AI Slicing</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          disabled={isBusy}
        >
          <Ionicons name="refresh" size={18} color={AppColors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Switcher Tabs */}
        <View style={styles.modeTabBar}>
          <TouchableOpacity
            style={[
              styles.modeTab,
              viewMode === 'camera' && styles.modeTabActive,
            ]}
            onPress={() => setViewMode('camera')}
          >
            <Ionicons
              name="camera"
              size={15}
              color={viewMode === 'camera' ? '#ffffff' : AppColors.textPrimary}
            />
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'camera' && styles.modeTabTextActive,
              ]}
            >
              Phone Camera (Live)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              viewMode === 'video_annotator' && styles.modeTabActive,
            ]}
            onPress={() => setViewMode('video_annotator')}
          >
            <Ionicons
              name="film"
              size={15}
              color={viewMode === 'video_annotator' ? '#ffffff' : AppColors.textPrimary}
            />
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'video_annotator' && styles.modeTabTextActive,
              ]}
            >
              Video Annotator (All Frames)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeTab,
              viewMode === 'simulation' && styles.modeTabActive,
            ]}
            onPress={() => setViewMode('simulation')}
          >
            <Ionicons
              name="play-forward"
              size={15}
              color={viewMode === 'simulation' ? '#ffffff' : AppColors.textPrimary}
            />
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'simulation' && styles.modeTabTextActive,
              ]}
            >
              Simulation
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── MODE 1: PHONE CAMERA DASHCAM ──────────────────────────────── */}
        {viewMode === 'camera' && (
          <View style={styles.sectionContainer}>
            {/* Camera Viewfinder Card */}
            <View style={styles.cameraCard}>
              {!permission?.granted ? (
                // Camera Permission Prompt
                <View style={styles.permissionBox}>
                  <Ionicons name="camera-reverse-outline" size={48} color={AppColors.primary} />
                  <Text style={styles.permissionTitle}>Phone Camera Access</Text>
                  <Text style={styles.permissionDesc}>
                    Mount your phone on your car dashboard. RoadMitra will use your camera to
                    capture frames and detect potholes every 10 seconds.
                  </Text>
                  <TouchableOpacity
                    style={styles.grantPermissionBtn}
                    onPress={requestPermission}
                  >
                    <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                    <Text style={styles.grantPermissionText}>Enable Phone Camera</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Live Phone Camera View
                <View style={styles.cameraWrapper}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.cameraView}
                    facing={facing}
                    enableTorch={isTorchOn}
                  />

                  {/* Viewfinder HUD Overlay */}
                  <View style={styles.hudOverlay} pointerEvents="box-none">
                    {/* Top Bar */}
                    <View style={styles.hudTopRow}>
                      <View style={styles.liveRecPill}>
                        <View
                          style={[
                            styles.liveRecDot,
                            isAutoCapturing && styles.liveRecDotBlinking,
                          ]}
                        />
                        <Text style={styles.liveRecText}>
                          {isAutoCapturing
                            ? `DASHCAM MODE: NEXT IN ${nextCaptureSec}s`
                            : 'PHONE CAMERA READY'}
                        </Text>
                      </View>

                      <View style={styles.cameraToolBtns}>
                        <TouchableOpacity
                          style={styles.toolBtn}
                          onPress={() =>
                            setFacing((f) => (f === 'back' ? 'front' : 'back'))
                          }
                        >
                          <Ionicons name="camera-reverse" size={16} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.toolBtn}
                          onPress={() => setIsTorchOn((t) => !t)}
                        >
                          <Ionicons
                            name={isTorchOn ? 'flash' : 'flash-off'}
                            size={16}
                            color={isTorchOn ? AppColors.secondary : '#ffffff'}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* AI Targeting Crosshair */}
                    <View style={styles.targetReticle}>
                      <View style={styles.reticleCrosshair}>
                        <Text style={styles.reticleText}>ROAD DETECTION ZONE</Text>
                      </View>
                    </View>

                    {/* Bottom Telemetry HUD */}
                    <View style={styles.hudBottomRow}>
                      <View style={styles.hudItem}>
                        <Ionicons name="speedometer-outline" size={13} color="#ffffff" />
                        <Text style={styles.hudText}>
                          {Math.round(liveGps.speed ?? 42)} km/h
                        </Text>
                      </View>
                      <View style={styles.hudItem}>
                        <Ionicons name="navigate-outline" size={13} color="#ffffff" />
                        <Text style={styles.hudText}>
                          {liveGps.latitude.toFixed(4)}°, {liveGps.longitude.toFixed(4)}°
                        </Text>
                      </View>
                      {isUploadingLive && (
                        <View style={styles.uploadingPill}>
                          <ActivityIndicator size="small" color="#ffffff" />
                          <Text style={styles.uploadingText}>AI Analyzing...</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Live Camera Controls */}
            {permission?.granted && (
              <View style={styles.cameraControlsRow}>
                {/* 10-Second Auto Capture Toggle */}
                <TouchableOpacity
                  style={[
                    styles.autoDashcamBtn,
                    isAutoCapturing && styles.autoDashcamBtnActive,
                  ]}
                  onPress={() => setIsAutoCapturing((prev) => !prev)}
                >
                  <Ionicons
                    name={isAutoCapturing ? 'pause-circle' : 'play-circle'}
                    size={22}
                    color="#ffffff"
                  />
                  <Text style={styles.autoDashcamBtnText}>
                    {isAutoCapturing
                      ? `Stop Auto 10s Mode (Next: ${nextCaptureSec}s)`
                      : 'Start Auto 10s Dashcam Drive Mode'}
                  </Text>
                </TouchableOpacity>

                {/* Instant Snap Button */}
                <TouchableOpacity
                  style={styles.snapNowBtn}
                  onPress={captureAndDetectFrame}
                  disabled={isUploadingLive}
                >
                  <Ionicons name="camera" size={18} color={AppColors.primary} />
                  <Text style={styles.snapNowBtnText}>Snap & Detect Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Image Bounding Box Visualizer for Phone Camera Frame */}
            {latestCapturedUri && (
              <View style={styles.detectionResultCard}>
                <View style={styles.detectionHeader}>
                  <Ionicons name="scan-circle" size={20} color={AppColors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detectionTitle}>
                      Real Camera Frame & AI Bounding Boxes
                    </Text>
                    <Text style={styles.detectionSubtitle}>
                      {latestDetections.length > 0
                        ? `Found ${latestDetections.length} road defect(s)`
                        : 'Road surface clean · No potholes detected'}
                    </Text>
                  </View>
                </View>

                {/* Bounding Box Visualizer Component */}
                <BBoxOverlay
                  imageUri={latestCapturedUri}
                  detections={latestDetections}
                />

                {/* Detections Detail Badges */}
                {latestDetections.length > 0 && (
                  <View style={styles.bboxesDetailList}>
                    {latestDetections.map((d, i) => (
                      <View key={i} style={styles.bboxDetailCard}>
                        <View style={styles.bboxTagBadge}>
                          <Text style={styles.bboxTagText}>#{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bboxClassText}>
                            {d.class_name} · {(d.confidence * 100).toFixed(1)}% Conf
                          </Text>
                          <Text style={styles.bboxSubText}>
                            Depth: {d.estimated_depth_cm} cm · Severity: {d.severity} ({d.repair_urgency})
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── MODE 2: FULL VIDEO ANNOTATOR (ALL FRAMES) ─────────────────── */}
        {viewMode === 'video_annotator' && (
          <View style={styles.sectionContainer}>
            <VideoAnnotator />
          </View>
        )}

        {/* ── MODE 3: AUTOMATED PIPELINE SIMULATION ──────────────────────── */}
        {viewMode === 'simulation' && (
          <View style={styles.sectionContainer}>
            {/* Animated Workflow Component */}
            <DashcamWorkflow
              currentStage={pipelineState.stage}
              progressPercent={pipelineState.progressPercent}
              statusMessage={pipelineState.statusMessage}
            />

            {/* Simulation Controls */}
            <View style={styles.simControlsCard}>
              <TouchableOpacity
                style={styles.simPrimaryBtn}
                onPress={() => handleStartSimulation(false)}
                disabled={isBusy}
              >
                <Ionicons name="play-circle" size={20} color="#ffffff" />
                <Text style={styles.simPrimaryText}>
                  Start 30s Simulated Drive (Auto 10s Extraction)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.simFastBtn}
                onPress={() => handleStartSimulation(true)}
                disabled={isBusy}
              >
                <Ionicons name="flash" size={16} color={AppColors.primary} />
                <Text style={styles.simFastText}>Fast Simulation (3-Second Test)</Text>
              </TouchableOpacity>
            </View>

            {/* Extracted 10-Second Frames */}
            {pipelineState.extractedFrames.length > 0 && (
              <View style={styles.extractedSection}>
                <Text style={styles.extractedTitle}>
                  Extracted 10s Keyframes ({pipelineState.extractedFrames.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {pipelineState.extractedFrames.map((frame) => (
                    <TouchableOpacity
                      key={frame.id}
                      style={[
                        styles.frameThumbCard,
                        activeFrameTab?.id === frame.id && styles.frameThumbActive,
                      ]}
                      onPress={() => setActiveFrameTab(frame)}
                    >
                      <Image
                        source={{ uri: frame.imageUri }}
                        style={styles.frameThumbImg}
                      />
                      <View style={styles.frameThumbBadge}>
                        <Text style={styles.frameThumbBadgeText}>
                          {frame.timestampLabel}
                        </Text>
                      </View>
                      <Text style={styles.frameThumbStatus}>
                        {frame.detections.length > 0
                          ? `⚠️ ${frame.detections[0].class_name} (${Math.round(
                              frame.detections[0].confidence * 100,
                            )}%)`
                          : '✓ Clear'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Active Selected Frame with Bounding Boxes */}
            {activeFrameTab && (
              <View style={styles.inspectionCard}>
                <Text style={styles.inspectionTitle}>
                  Bounding Box Inspector @ {activeFrameTab.timestampLabel}
                </Text>
                <BBoxOverlay
                  imageUri={activeFrameTab.imageUri}
                  detections={activeFrameTab.detections}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppColors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: AppColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  wifiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  wifiPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 4,
  },
  modeTabActive: {
    backgroundColor: AppColors.primary,
  },
  modeTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  sectionContainer: {
    gap: 14,
  },
  cameraCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: AppColors.border,
    minHeight: 280,
  },
  permissionBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: AppColors.surface,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  permissionDesc: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  grantPermissionBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  grantPermissionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cameraWrapper: {
    width: '100%',
    height: 300,
    position: 'relative',
    overflow: 'hidden',
  },
  cameraView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hudOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  hudTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveRecPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  liveRecDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.success,
  },
  liveRecDotBlinking: {
    backgroundColor: AppColors.accent,
  },
  liveRecText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cameraToolBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetReticle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleCrosshair: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  reticleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  hudBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  hudItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hudText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  uploadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AppColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  uploadingText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  cameraControlsRow: {
    gap: 10,
  },
  autoDashcamBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  autoDashcamBtnActive: {
    backgroundColor: AppColors.accent,
  },
  autoDashcamBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  snapNowBtn: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  snapNowBtnText: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  detectionResultCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  detectionSubtitle: {
    fontSize: 11,
    color: AppColors.textSecondary,
  },
  bboxesDetailList: {
    gap: 8,
  },
  bboxDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.cardMuted,
    padding: 10,
    borderRadius: 10,
  },
  bboxTagBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bboxTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  bboxClassText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  bboxSubText: {
    fontSize: 10,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  simControlsCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
  },
  simPrimaryBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  simFastBtn: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  simFastText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  extractedSection: {
    gap: 8,
  },
  extractedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  frameThumbCard: {
    width: 140,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: AppColors.border,
    marginRight: 10,
  },
  frameThumbActive: {
    borderColor: AppColors.primary,
  },
  frameThumbImg: {
    width: '100%',
    height: 80,
  },
  frameThumbBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  frameThumbBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  frameThumbStatus: {
    fontSize: 10,
    fontWeight: '700',
    padding: 6,
    color: AppColors.textPrimary,
  },
  inspectionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 10,
  },
  inspectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
});
