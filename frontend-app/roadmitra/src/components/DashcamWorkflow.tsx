import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { PipelineStage } from '../services/dashcamService';

interface DashcamWorkflowProps {
  currentStage: PipelineStage;
  progressPercent: number;
  statusMessage: string;
}

interface StepDef {
  key: PipelineStage;
  index: number;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STEPS: StepDef[] = [
  {
    key: 'recording',
    index: 1,
    label: 'WiFi Dashcam',
    sublabel: 'Continuous Rec',
    icon: 'videocam',
  },
  {
    key: 'extracting',
    index: 2,
    label: '10s Extractor',
    sublabel: 'Keyframe Slicing',
    icon: 'film',
  },
  {
    key: 'detecting',
    index: 3,
    label: 'AI Inference',
    sublabel: 'YOLO + Depth',
    icon: 'hardware-chip',
  },
  {
    key: 'completed',
    index: 4,
    label: 'Dashboard',
    sublabel: 'GIS Map Sync',
    icon: 'analytics',
  },
];

function getStageIndex(stage: PipelineStage): number {
  switch (stage) {
    case 'idle':
      return 0;
    case 'recording':
      return 1;
    case 'extracting':
      return 2;
    case 'detecting':
      return 3;
    case 'completed':
      return 4;
    case 'error':
      return -1;
  }
}

export function DashcamWorkflow({
  currentStage,
  progressPercent,
  statusMessage,
}: DashcamWorkflowProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeIdx = getStageIndex(currentStage);

  useEffect(() => {
    if (currentStage !== 'idle' && currentStage !== 'completed') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 650,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 650,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [currentStage, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Workflow Header Banner */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <Text style={styles.title}>Automated Dashcam Pipeline</Text>
          <View style={styles.liveBadge}>
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor:
                    currentStage === 'idle'
                      ? AppColors.textMuted
                      : currentStage === 'completed'
                      ? AppColors.success
                      : AppColors.accent,
                },
              ]}
            />
            <Text style={styles.liveText}>
              {currentStage === 'idle'
                ? 'STANDBY'
                : currentStage === 'completed'
                ? 'COMPLETE'
                : 'PROCESSING'}
            </Text>
          </View>
        </View>
        <Text style={styles.bandwidthPill}>⚡ 98.4% Data Saved</Text>
      </View>

      {/* 4-Stage Animated Flow Nodes */}
      <View style={styles.workflowTrack}>
        {STEPS.map((step, idx) => {
          const isCurrent = activeIdx === step.index;
          const isPassed = activeIdx > step.index || currentStage === 'completed';

          return (
            <React.Fragment key={step.key}>
              {/* Step Node */}
              <View style={styles.nodeColumn}>
                <Animated.View
                  style={[
                    styles.nodeCircle,
                    isPassed && styles.nodePassed,
                    isCurrent && styles.nodeCurrent,
                    isCurrent && {
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  {isPassed ? (
                    <Ionicons name="checkmark" size={18} color="#ffffff" />
                  ) : (
                    <Ionicons
                      name={step.icon}
                      size={17}
                      color={isCurrent ? AppColors.surface : AppColors.textSecondary}
                    />
                  )}
                </Animated.View>

                <Text
                  style={[
                    styles.nodeLabel,
                    (isCurrent || isPassed) && styles.nodeLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                <Text style={styles.nodeSublabel} numberOfLines={1}>
                  {step.sublabel}
                </Text>
              </View>

              {/* Connecting Connector Line */}
              {idx < STEPS.length - 1 && (
                <View style={styles.connectorWrapper}>
                  <View
                    style={[
                      styles.connectorLine,
                      activeIdx > step.index && styles.connectorLineActive,
                    ]}
                  />
                  {activeIdx === step.index && (
                    <Ionicons
                      name="chevron-forward"
                      size={12}
                      color={AppColors.primary}
                      style={styles.connectorArrow}
                    />
                  )}
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Real-time Status & Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.max(4, Math.min(100, progressPercent))}%` },
            ]}
          />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusText} numberOfLines={1}>
            {statusMessage}
          </Text>
          <Text style={styles.percentText}>{progressPercent}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: -0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
  },
  bandwidthPill: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
    backgroundColor: AppColors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  workflowTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 68,
  },
  nodeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  nodePassed: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  nodeCurrent: {
    backgroundColor: AppColors.accent,
    borderColor: AppColors.accent,
    shadowColor: AppColors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  nodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  nodeLabelActive: {
    color: AppColors.textPrimary,
    fontWeight: '800',
  },
  nodeSublabel: {
    fontSize: 8,
    fontWeight: '600',
    color: AppColors.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  connectorWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    marginBottom: 20,
  },
  connectorLine: {
    width: '100%',
    height: 2,
    backgroundColor: AppColors.border,
  },
  connectorLineActive: {
    backgroundColor: AppColors.primary,
  },
  connectorArrow: {
    position: 'absolute',
  },
  progressContainer: {
    gap: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: AppColors.borderLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: AppColors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  percentText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
});
