import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { DashcamWorkflow } from '../components/DashcamWorkflow';
import {
  dashcamService,
  DashcamPipelineState,
  ExtractedFrame,
} from '../services/dashcamService';

export default function DashcamPipelineScreen() {
  const [pipelineState, setPipelineState] = useState<DashcamPipelineState>(
    dashcamService.getState(),
  );
  const [activeFrameTab, setActiveFrameTab] = useState<ExtractedFrame | null>(null);

  useEffect(() => {
    const unsubscribe = dashcamService.subscribe((s) => {
      setPipelineState(s);
      if (s.extractedFrames.length > 0 && !activeFrameTab) {
        setActiveFrameTab(s.extractedFrames[0]);
      }
    });
    return unsubscribe;
  }, [activeFrameTab]);

  const handleStartSimulation = async (fastMode: boolean = false) => {
    await dashcamService.runPipelineSimulation({
      recordingDurationSec: 30,
      speedMultiplier: fastMode ? 5 : 1,
    });
  };

  const handleReset = () => {
    dashcamService.reset();
    setActiveFrameTab(null);
  };

  const isBusy =
    pipelineState.stage === 'recording' ||
    pipelineState.stage === 'extracting' ||
    pipelineState.stage === 'detecting';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={isBusy}
        >
          <Ionicons name="arrow-back" size={20} color={AppColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>WiFi Dashcam Pipeline</Text>
          <View style={styles.wifiPill}>
            <Ionicons name="wifi" size={12} color={AppColors.success} />
            <Text style={styles.wifiPillText}>
              {pipelineState.wifiSSID} · 192.168.1.105
            </Text>
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
        {/* Animated Workflow Diagram */}
        <DashcamWorkflow
          currentStage={pipelineState.stage}
          progressPercent={pipelineState.progressPercent}
          statusMessage={pipelineState.statusMessage}
        />

        {/* Dashcam Viewfinder / Playback Player */}
        <View style={styles.viewfinderCard}>
          <View style={styles.viewfinderScreen}>
            {/* Background Simulated Road View */}
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1000&auto=format&fit=crop&q=80',
              }}
              style={styles.viewfinderImage}
              resizeMode="cover"
            />

            {/* Dark overlay gradient */}
            <View style={styles.viewfinderOverlay} />

            {/* HUD Status Bar */}
            <View style={styles.hudTopBar}>
              <View style={styles.recBadge}>
                <View
                  style={[
                    styles.recDot,
                    pipelineState.stage === 'recording' && styles.recDotFlashing,
                  ]}
                />
                <Text style={styles.recText}>
                  {pipelineState.stage === 'recording'
                    ? `REC 00:${String(pipelineState.elapsedRecordingSec).padStart(2, '0')} / 00:30`
                    : pipelineState.stage === 'idle'
                    ? 'STANDBY'
                    : 'RECORDED (00:30)'}
                </Text>
              </View>

              <View style={styles.hudSpecs}>
                <Text style={styles.hudSpecsText}>1080p 30FPS · H.265</Text>
              </View>
            </View>

            {/* AI HUD Target Reticle (Simulating real-time AI scan) */}
            {pipelineState.stage === 'detecting' && (
              <View style={styles.reticleBox}>
                <View style={styles.reticleBorder}>
                  <Text style={styles.reticleLabel}>AI SCANNING 10s KEYFRAME</Text>
                </View>
              </View>
            )}

            {/* HUD Bottom Telemetry */}
            <View style={styles.hudBottomBar}>
              <View style={styles.hudTelemetryItem}>
                <Ionicons name="speedometer-outline" size={14} color="#ffffff" />
                <Text style={styles.hudTelemetryText}>42.5 km/h</Text>
              </View>
              <View style={styles.hudTelemetryItem}>
                <Ionicons name="navigate-outline" size={14} color="#ffffff" />
                <Text style={styles.hudTelemetryText}>28.6145° N, 77.2094° E</Text>
              </View>
              <View style={styles.hudTelemetryItem}>
                <Ionicons name="battery-charging-outline" size={14} color="#ffffff" />
                <Text style={styles.hudTelemetryText}>94%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.controlsCard}>
          {pipelineState.stage === 'idle' && (
            <View style={styles.actionButtonsCol}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => handleStartSimulation(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="play-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryActionText}>
                  Start 30s Dashcam Drive (Auto 10s Extraction)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => handleStartSimulation(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={18} color={AppColors.primary} />
                <Text style={styles.secondaryActionText}>
                  Instant 10s Simulation (Fast Test)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {pipelineState.stage === 'recording' && (
            <View style={styles.recordingStatusBox}>
              <ActivityIndicator size="small" color={AppColors.accent} />
              <Text style={styles.recordingStatusText}>
                Recording continuous road video... Automatically extracts frames every 10s
                when done!
              </Text>
            </View>
          )}

          {(pipelineState.stage === 'extracting' ||
            pipelineState.stage === 'detecting') && (
            <View style={styles.processingStatusBox}>
              <ActivityIndicator size="small" color={AppColors.primary} />
              <Text style={styles.processingStatusText}>
                {pipelineState.statusMessage}
              </Text>
            </View>
          )}

          {pipelineState.stage === 'completed' && (
            <View style={styles.completedActions}>
              <View style={styles.completedBanner}>
                <Ionicons name="checkmark-circle" size={24} color={AppColors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedBannerTitle}>
                    Pipeline Completed Successfully!
                  </Text>
                  <Text style={styles.completedBannerSubtitle}>
                    {pipelineState.stats.totalPotholesFound} road defects registered to
                    GIS Database & Synced with Map
                  </Text>
                </View>
              </View>

              <View style={styles.completedBtnRow}>
                <TouchableOpacity
                  style={styles.mapActionBtn}
                  onPress={() => router.push('/(tabs)/map')}
                >
                  <Ionicons name="map" size={18} color="#ffffff" />
                  <Text style={styles.mapActionText}>View on Interactive Map</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.replayActionBtn}
                  onPress={() => handleStartSimulation(true)}
                >
                  <Ionicons name="repeat" size={18} color={AppColors.primary} />
                  <Text style={styles.replayActionText}>Run Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Extracted 10-Second Keyframes Gallery */}
        {pipelineState.extractedFrames.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Extracted Frames (Every 10 Seconds)
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Only these keyframes were uploaded to the AI server
                </Text>
              </View>
              <View style={styles.frameCounterBadge}>
                <Text style={styles.frameCounterText}>
                  {pipelineState.extractedFrames.length} Frames
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.framesScrollView}
            >
              {pipelineState.extractedFrames.map((frame, idx) => {
                const isSelected = activeFrameTab?.id === frame.id;
                const hasDetections = frame.detections.length > 0;

                return (
                  <TouchableOpacity
                    key={frame.id}
                    style={[
                      styles.frameCard,
                      isSelected && styles.frameCardSelected,
                      hasDetections && styles.frameCardHazard,
                    ]}
                    onPress={() => setActiveFrameTab(frame)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: frame.imageUri }}
                      style={styles.frameThumbnail}
                    />

                    {/* Timestamp Tag */}
                    <View style={styles.frameTimeBadge}>
                      <Ionicons name="time-outline" size={10} color="#ffffff" />
                      <Text style={styles.frameTimeText}>{frame.timestampLabel}</Text>
                    </View>

                    {/* Status Pill */}
                    <View
                      style={[
                        styles.frameStatusPill,
                        hasDetections
                          ? styles.statusPillHazard
                          : styles.statusPillClear,
                      ]}
                    >
                      <Ionicons
                        name={
                          hasDetections ? 'alert-circle' : 'checkmark-circle'
                        }
                        size={12}
                        color={
                          hasDetections ? AppColors.accent : AppColors.success
                        }
                      />
                      <Text
                        style={[
                          styles.frameStatusText,
                          {
                            color: hasDetections
                              ? AppColors.accent
                              : AppColors.success,
                          },
                        ]}
                      >
                        {hasDetections
                          ? `${frame.detections[0].class_name} (${Math.round(
                              frame.detections[0].confidence * 100,
                            )}%)`
                          : 'Clear Road'}
                      </Text>
                    </View>

                    {/* Depth info if detected */}
                    {hasDetections && (
                      <View style={styles.depthTagRow}>
                        <Text style={styles.depthTagText}>
                          Depth: {frame.detections[0].estimated_depth_cm}cm ·{' '}
                          {frame.detections[0].severity}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Selected Frame Detailed Inspector */}
        {activeFrameTab && activeFrameTab.detections.length > 0 && (
          <View style={styles.inspectorCard}>
            <View style={styles.inspectorHeader}>
              <View style={styles.inspectorTitleRow}>
                <Ionicons name="scan-circle" size={20} color={AppColors.accent} />
                <Text style={styles.inspectorTitle}>
                  AI Detection on Frame @ {activeFrameTab.timestampLabel}
                </Text>
              </View>
              <View style={styles.latencyBadge}>
                <Text style={styles.latencyText}>
                  Latency: {activeFrameTab.latencyMs ?? 184} ms
                </Text>
              </View>
            </View>

            <View style={styles.inspectorBody}>
              {activeFrameTab.detections.map((d, i) => (
                <View key={i} style={styles.defectDetailRow}>
                  <View style={styles.defectIconBox}>
                    <Ionicons
                      name="warning"
                      size={18}
                      color={
                        d.severity === 'Critical'
                          ? AppColors.danger
                          : AppColors.accentOrange
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.defectHeaderLine}>
                      <Text style={styles.defectClassText}>{d.class_name}</Text>
                      <Text style={styles.defectConfText}>
                        Confidence: {(d.confidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <Text style={styles.defectSubText}>
                      Estimated Depth: {d.estimated_depth_cm} cm · Severity: {d.severity} ·{' '}
                      {d.repair_urgency}
                    </Text>
                    <Text style={styles.defectGpsText}>
                      GPS: {activeFrameTab.gps.latitude.toFixed(6)}° N,{' '}
                      {activeFrameTab.gps.longitude.toFixed(6)}° E
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Real-time Streaming Activity Log */}
        <View style={styles.terminalCard}>
          <View style={styles.terminalHeader}>
            <Ionicons name="terminal-outline" size={16} color={AppColors.surface} />
            <Text style={styles.terminalTitle}>Pipeline Activity Stream</Text>
            <View style={styles.terminalDot} />
          </View>

          <View style={styles.terminalContent}>
            {pipelineState.logs.slice(0, 8).map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text
                  style={[
                    styles.logTag,
                    log.level === 'warn' && styles.logTagWarn,
                    log.level === 'success' && styles.logTagSuccess,
                    log.level === 'error' && styles.logTagError,
                  ]}
                >
                  [{log.tag}]
                </Text>
                <Text style={styles.logMessage} numberOfLines={2}>
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        </View>
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
    fontSize: 16,
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
  viewfinderCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  viewfinderScreen: {
    height: 200,
    position: 'relative',
    justifyContent: 'space-between',
    padding: 12,
  },
  viewfinderImage: {
    ...StyleSheet.absoluteFill,
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  hudTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.textMuted,
  },
  recDotFlashing: {
    backgroundColor: AppColors.accent,
  },
  recText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hudSpecs: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hudSpecsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  reticleBox: {
    position: 'absolute',
    top: 50,
    left: 40,
    right: 40,
    bottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  reticleBorder: {
    borderWidth: 2,
    borderColor: AppColors.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
  },
  reticleLabel: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hudBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 2,
  },
  hudTelemetryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hudTelemetryText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  controlsCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  actionButtonsCol: {
    gap: 10,
  },
  primaryActionBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  secondaryActionText: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  recordingStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  recordingStatusText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  processingStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  processingStatusText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  completedActions: {
    gap: 12,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppColors.successBg,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.successBorder,
  },
  completedBannerTitle: {
    color: AppColors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  completedBannerSubtitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  completedBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mapActionBtn: {
    flex: 2,
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  replayActionBtn: {
    flex: 1,
    backgroundColor: AppColors.cardAlt,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  replayActionText: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 1,
  },
  frameCounterBadge: {
    backgroundColor: AppColors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  frameCounterText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.primary,
  },
  framesScrollView: {
    gap: 12,
    paddingVertical: 4,
  },
  frameCard: {
    width: 170,
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  frameCardSelected: {
    borderColor: AppColors.primary,
  },
  frameCardHazard: {
    borderColor: AppColors.accent,
  },
  frameThumbnail: {
    width: '100%',
    height: 96,
  },
  frameTimeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  frameTimeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  frameStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusPillHazard: {
    backgroundColor: AppColors.dangerBg,
  },
  statusPillClear: {
    backgroundColor: AppColors.successBg,
  },
  frameStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  depthTagRow: {
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  depthTagText: {
    fontSize: 9,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  inspectorCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 10,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inspectorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inspectorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  latencyBadge: {
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  latencyText: {
    fontSize: 9,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  inspectorBody: {
    gap: 8,
  },
  defectDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: AppColors.cardMuted,
    padding: 10,
    borderRadius: 12,
  },
  defectIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: AppColors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defectHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defectClassText: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  defectConfText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.accent,
  },
  defectSubText: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  defectGpsText: {
    fontSize: 10,
    color: AppColors.textMuted,
    marginTop: 2,
  },
  terminalCard: {
    backgroundColor: AppColors.primary,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  terminalTitle: {
    color: AppColors.surface,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  terminalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.secondary,
  },
  terminalContent: {
    gap: 6,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  logTime: {
    color: AppColors.secondary,
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logTag: {
    color: '#86efac',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logTagWarn: {
    color: '#fde047',
  },
  logTagSuccess: {
    color: '#86efac',
  },
  logTagError: {
    color: '#fca5a5',
  },
  logMessage: {
    color: '#e2e8f0',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
});
