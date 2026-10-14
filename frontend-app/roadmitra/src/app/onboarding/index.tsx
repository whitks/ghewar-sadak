import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

const BULLETS = [
  {
    icon: 'navigate-outline' as const,
    title: 'High-Accuracy GPS',
    desc: 'Pins road jolts and cracks to precise coordinates for spatial clustering.',
  },
  {
    icon: 'pulse-outline' as const,
    title: 'Vibration & Shock Telemetry',
    desc: 'Accelerometer samples at 20 Hz to feel potholes and surface roughness.',
  },
  {
    icon: 'camera-outline' as const,
    title: 'Road Evidence Camera',
    desc: 'Capture road defect photos. Privacy protected with automatic blur.',
  },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={38} color={AppColors.primary} />
          </View>
          <Text style={styles.appName}>RoadPulse</Text>
          <Text style={styles.tagline}>
            Crowdsourced road hazard detection & multi-sensor fusion
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Required Mobile Telemetry</Text>
        {BULLETS.map((b) => (
          <View key={b.title} style={styles.bullet}>
            <View style={styles.bulletIconBox}>
              <Ionicons name={b.icon} size={22} color={AppColors.primary} />
            </View>
            <View style={styles.bulletText}>
              <Text style={styles.bulletTitle}>{b.title}</Text>
              <Text style={styles.bulletDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}

        <View style={styles.privacyBox}>
          <View style={styles.privacyHeader}>
            <Ionicons name="lock-closed-outline" size={16} color={AppColors.primary} />
            <Text style={styles.privacyTitle}>Privacy By Design</Text>
          </View>
          <Text style={styles.privacyText}>
            No personal accounts or IMEI tracking. Location tracking runs strictly during active trips. Photos are processed to blur any visible faces or vehicle plates.
          </Text>
        </View>

        <Button
          title="Grant Sensor Permissions"
          variant="primary"
          size="lg"
          fullWidth
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => router.push('/onboarding/permissions')}
          style={{ marginTop: 8, marginBottom: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 22, gap: 14 },
  hero: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  appName: { fontSize: 32, fontWeight: '800', color: AppColors.textPrimary, letterSpacing: -0.8 },
  tagline: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },
  sectionTitle: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  bullet: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bulletIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  bulletText: { flex: 1, gap: 3 },
  bulletTitle: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700' },
  bulletDesc: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 17 },
  privacyBox: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 6,
  },
  privacyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyTitle: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
  privacyText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 18 },
});
