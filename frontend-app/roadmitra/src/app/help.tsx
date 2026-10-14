import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { AppColors } from '../constants/theme';

const FAQS = [
  {
    q: 'GPS is showing poor accuracy',
    a: 'Move to an open area away from tall buildings. GPS typically needs 30–60 seconds to obtain a strong fix. Accuracy below 30 m is required for events to be counted.',
  },
  {
    q: 'Sensor data shows "unavailable"',
    a: 'Some Android devices restrict accelerometer access in the background. Go to Settings → Sensors and make sure motion sensor access is enabled. On iOS, Motion & Fitness access is required.',
  },
  {
    q: 'Connection failed / upload errors',
    a: 'Check your internet connection. Events are stored locally and will upload automatically when you reconnect. Use Upload Queue to retry manually.',
  },
  {
    q: 'No hazards showing on the map',
    a: 'The app defaults to demo data around Mumbai. If you are in a different city, the server will fetch hazards for your current location after you grant location permission.',
  },
  {
    q: 'Battery draining quickly',
    a: 'GPS and continuous accelerometer use can drain battery. Disable Background Tracking in Settings if you only want to record when the app is open.',
  },
  {
    q: 'False detections / too many events',
    a: 'Adjust the sensor sensitivity in Settings → Sensors. Avoid windshield mounts (see Calibration Guide). The scoring engine filters individual device anomalies.',
  },
];

export default function HelpScreen() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Help & Troubleshooting</Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.faqCard, expanded === i && styles.faqCardOpen]}
            onPress={() => setExpanded(expanded === i ? null : i)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Text style={styles.faqChevron}>{expanded === i ? '▲' : '▼'}</Text>
            </View>
            {expanded === i && (
              <Text style={styles.faqA}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>Still stuck?</Text>
          <Text style={styles.contactText}>
            RoadPulse is a hackathon project. For questions or feedback, open an issue on the GitHub repository or contact the team.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: AppColors.primary, fontSize: 15, fontWeight: '700' },
  title: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  faqCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 8,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  faqCardOpen: { borderColor: AppColors.primary },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faqQ: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  faqChevron: { color: AppColors.textSecondary, fontSize: 12 },
  faqA: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 20 },
  contactBox: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginTop: 8,
  },
  contactTitle: { color: AppColors.primary, fontSize: 15, fontWeight: '700' },
  contactText: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 20 },
});
