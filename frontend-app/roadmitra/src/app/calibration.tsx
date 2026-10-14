import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { Card } from '../components/ui/Card';

const STEPS = [
  {
    icon: 'phone-portrait-outline' as const,
    title: 'Flat on dashboard, screen up',
    desc: 'Place your phone flat on the dashboard tray or console. This gives the vertical Z-axis accelerometer direct coupling with vehicle chassis vibrations.',
    good: true,
  },
  {
    icon: 'car-outline' as const,
    title: 'Center axis of the vehicle',
    desc: 'Dock along the vehicle centerline for symmetric reading across left and right wheel strikes.',
    good: true,
  },
  {
    icon: 'warning-outline' as const,
    title: 'Avoid loose windshield suction arms',
    desc: 'Flexible suction arms introduce resonance wobble that can cause false pothole triggers.',
    good: false,
  },
  {
    icon: 'volume-high-outline' as const,
    title: 'Subwoofer acoustic isolation',
    desc: 'Heavy low-frequency bass can vibrate phone MEMS sensors. Mount away from subwoofers.',
    good: false,
  },
];

export default function CalibrationScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Sensor Calibration</Text>
        <Text style={styles.subtitle}>
          Proper docking ensures accurate distinction between real road potholes and passenger cabin movements.
        </Text>

        {STEPS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.step,
              s.good ? styles.stepGood : styles.stepBad,
            ]}
          >
            <View style={[styles.stepIconBox, { backgroundColor: s.good ? AppColors.successBg : AppColors.dangerBg }]}>
              <Ionicons
                name={s.icon}
                size={22}
                color={s.good ? AppColors.success : AppColors.danger}
              />
            </View>
            <View style={styles.stepInfo}>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <View
                  style={[
                    styles.tagBadge,
                    { backgroundColor: s.good ? AppColors.successBg : AppColors.dangerBg },
                  ]}
                >
                  <Text style={[styles.tagText, { color: s.good ? AppColors.success : AppColors.danger }]}>
                    {s.good ? 'RECOMMENDED' : 'AVOID'}
                  </Text>
                </View>
              </View>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          </View>
        ))}

        <Card variant="cardAlt">
          <Text style={styles.limitationsTitle}>RoadPulse Filtering Safeguards</Text>
          <Text style={styles.limitationsText}>
            {'• Phone sensors detect vertical shocks — not visual cracks or minor surface texture.\n• GPS accuracy below 30 m is mandatory for spatial clustering.\n• Speeds below 7 km/h: automatically filtered to prevent false positive triggers during parking.\n• Multi-pass DBSCAN merges reports across multiple vehicles into unified hazard records.'}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backBtnText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 19 },
  step: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    backgroundColor: AppColors.surface,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stepGood: { borderColor: AppColors.successBorder },
  stepBad: { borderColor: AppColors.dangerBorder },
  stepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInfo: { flex: 1, gap: 4 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepTitle: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 6 },
  tagBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  stepDesc: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 17 },
  limitationsTitle: { color: AppColors.primary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  limitationsText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 20 },
});
