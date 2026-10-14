import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MOCK_HAZARDS, Hazard } from '../../services/mockData';
import { storage } from '../../services/storage';
import { HAZARD_LABELS, HAZARD_VECTOR_ICONS, STATUS_COLORS } from '../../constants/hazardTypes';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AppColors } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function HazardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hazard, setHazard] = useState<Hazard | null>(null);

  useEffect(() => {
    async function load() {
      const stored = await storage.getHazards();
      const all = [...stored, ...MOCK_HAZARDS];
      const found = all.find((h) => h.id === id);
      setHazard(found ?? null);
    }
    load();
  }, [id]);

  if (!hazard) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.notFound}>Hazard record not found</Text>
          <Button
            title="Go Back"
            variant="outline"
            icon="arrow-back"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const confidencePct = Math.round(hazard.confidence * 100);
  const confidenceColor = STATUS_COLORS[hazard.status];
  const iconName = HAZARD_VECTOR_ICONS[hazard.type] || 'alert-circle';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Map</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconBox}>
            <MaterialCommunityIcons name={iconName} size={32} color={AppColors.primary} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroType}>{HAZARD_LABELS[hazard.type]}</Text>
            <StatusBadge status={hazard.status} />
          </View>
        </View>

        {/* Confidence Breakdown Card */}
        <Card variant="elevated">
          <Text style={styles.cardTitle}>Fused Confidence Model (API v2)</Text>

          <View style={styles.mainScore}>
            <Text style={[styles.mainScoreNum, { color: confidenceColor }]}>
              {confidencePct}%
            </Text>
            <Text style={styles.mainScoreLabel}>Fused Score F = w_c·C + w_p·M + bonus</Text>
          </View>

          <View style={styles.scoreComponents}>
            {hazard.cameraScore !== undefined ? (
              <ScoreRow
                label="Vision AI Confidence (C)"
                value={hazard.cameraScore}
                icon="camera-outline"
                color={AppColors.info}
                weight={0.45}
              />
            ) : (
              <View style={styles.unavailRow}>
                <Ionicons name="camera-outline" size={16} color={AppColors.textMuted} />
                <Text style={styles.unavailText}>Vision evidence: not captured for this defect</Text>
              </View>
            )}

            {hazard.phoneScore !== undefined ? (
              <ScoreRow
                label="Phone IMU Shock Score (M)"
                value={hazard.phoneScore}
                icon="phone-portrait-outline"
                color={AppColors.success}
                weight={0.55}
              />
            ) : (
              <View style={styles.unavailRow}>
                <Ionicons name="phone-portrait-outline" size={16} color={AppColors.textMuted} />
                <Text style={styles.unavailText}>Phone IMU: vibration threshold unavailable</Text>
              </View>
            )}
          </View>

          {hazard.source === 'both' &&
            hazard.cameraScore !== undefined &&
            hazard.phoneScore !== undefined &&
            hazard.cameraScore >= 0.4 &&
            hazard.phoneScore >= 0.4 && (
              <View style={styles.bonusRow}>
                <Ionicons name="checkmark-circle" size={16} color={AppColors.success} />
                <Text style={styles.bonusText}>
                  Agreement bonus applied (+0.10) — Vision AI and phone accelerometer agree.
                </Text>
              </View>
            )}

          {hazard.status === 'conflicting' && (
            <View style={styles.conflictRow}>
              <Ionicons name="warning-outline" size={16} color={AppColors.warning} />
              <Text style={styles.conflictText}>
                Conflicting evidence: Camera detected visual defect, but vehicles passed smoothly. Confidence capped at 60%.
              </Text>
            </View>
          )}
        </Card>

        {/* Location Card */}
        <Card variant="elevated">
          <Text style={styles.cardTitle}>Spatial Geotag</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={20} color={AppColors.primary} />
            <Text style={styles.coords}>
              {hazard.lat.toFixed(5)}, {hazard.lon.toFixed(5)}
            </Text>
          </View>
          <Text style={styles.lastSeen}>
            Last verified: {new Date(hazard.lastSeen).toLocaleString('en-IN')}
          </Text>
        </Card>

        {/* Visual Evidence Photo */}
        {hazard.photoUri && (
          <Card variant="elevated">
            <Text style={styles.cardTitle}>Visual Evidence (Camera Capture)</Text>
            <Image
              source={{ uri: hazard.photoUri }}
              style={styles.evidencePhoto}
              resizeMode="cover"
            />
          </Card>
        )}

        {/* Evidence Metadata */}
        <Card variant="elevated">
          <Text style={styles.cardTitle}>Observation Provenance</Text>
          <View style={styles.evidenceRow}>
            <Text style={styles.evidenceLabel}>Sensor Source</Text>
            <Text style={styles.evidenceValue}>
              {hazard.source === 'both'
                ? 'Camera Vision + Phone IMU'
                : hazard.source === 'camera'
                ? 'Camera Vision Only'
                : 'Phone IMU Accelerometer'}
            </Text>
          </View>
          {hazard.magnitude && (
            <View style={styles.evidenceRow}>
              <Text style={styles.evidenceLabel}>Peak Accelerometer Jolt</Text>
              <Text style={[styles.evidenceValue, { color: AppColors.accent, fontWeight: '800' }]}>
                {hazard.magnitude}G {hazard.speedKmh ? `@ ${Math.round(hazard.speedKmh)} km/h` : ''}
              </Text>
            </View>
          )}
          <View style={styles.evidenceRow}>
            <Text style={styles.evidenceLabel}>Corroborating Devices</Text>
            <Text style={styles.evidenceValue}>
              {hazard.deviceCount} distinct vehicle{hazard.deviceCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.evidenceRow}>
            <Text style={styles.evidenceLabel}>Impact Severity</Text>
            <Text style={styles.evidenceValue}>{hazard.severity}/100</Text>
          </View>
          {hazard.description && (
            <Text style={styles.descText}>{hazard.description}</Text>
          )}
        </Card>

        <Button
          title="File Field Verification Report"
          variant="primary"
          size="lg"
          fullWidth
          icon="add-circle-outline"
          onPress={() => router.push('/(tabs)/report')}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreRow({
  label,
  value,
  icon,
  color,
  weight,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  weight: number;
}) {
  const pct = Math.round(value * 100);
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreRowHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.scoreRowLabel}>{label}</Text>
        <Text style={styles.scoreRowWeight}>wt {weight}</Text>
        <Text style={[styles.scoreRowValue, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound: { color: AppColors.textSecondary, fontSize: 16, fontWeight: '600' },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  heroIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroInfo: { flex: 1, gap: 4 },
  heroType: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  cardTitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  mainScore: { alignItems: 'center', paddingVertical: 10 },
  mainScoreNum: { fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  mainScoreLabel: { color: AppColors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  scoreComponents: { gap: 12, marginTop: 12 },
  scoreRow: { gap: 6 },
  scoreRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreRowLabel: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  scoreRowWeight: { color: AppColors.textMuted, fontSize: 11, fontWeight: '500' },
  scoreRowValue: { fontSize: 14, fontWeight: '800' },
  barTrack: { height: 6, backgroundColor: AppColors.borderLight, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  unavailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.cardAlt,
    padding: 10,
    borderRadius: 10,
  },
  unavailText: { color: AppColors.textMuted, fontSize: 12, fontStyle: 'italic' },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.successBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.successBorder,
    marginTop: 12,
  },
  bonusText: { color: AppColors.success, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  conflictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.warningBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.warningBorder,
    marginTop: 12,
  },
  conflictText: { color: AppColors.warning, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  coords: { color: AppColors.textPrimary, fontSize: 16, fontWeight: '800' },
  lastSeen: { color: AppColors.textSecondary, fontSize: 12 },
  evidenceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  evidenceLabel: { color: AppColors.textSecondary, fontSize: 13, fontWeight: '500' },
  evidenceValue: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700' },
  descText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
  },
  evidencePhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 10,
  },
});
