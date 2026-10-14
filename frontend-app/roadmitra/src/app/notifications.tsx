import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';

const NOTIFICATIONS: Array<{
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  time: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    id: '1',
    icon: 'checkmark-circle-outline',
    title: 'Trip Telemetry Uploaded',
    body: 'Your road surface trace from Linking Road was uploaded and synced with the fusion pipeline.',
    time: '2h ago',
    color: AppColors.success,
    bg: AppColors.successBg,
    border: AppColors.successBorder,
  },
  {
    id: '2',
    icon: 'alert-circle-outline',
    title: 'Hazard Confirmed by Multi-Vehicle Sensor Fusion',
    body: 'Pothole on Linking Road corroborated by 4 vehicles. Confidence updated to 87%.',
    time: '4h ago',
    color: AppColors.warning,
    bg: AppColors.warningBg,
    border: AppColors.warningBorder,
  },
  {
    id: '3',
    icon: 'cloud-offline-outline',
    title: 'Offline Queue Synced',
    body: 'Vibration event backlog saved locally has been uploaded upon reconnecting.',
    time: '1d ago',
    color: AppColors.info,
    bg: AppColors.infoBg,
    border: AppColors.infoBorder,
  },
];

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Notifications</Text>

        {NOTIFICATIONS.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color={AppColors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          NOTIFICATIONS.map((n) => (
            <View key={n.id} style={styles.notifCard}>
              <View style={[styles.notifIconBox, { backgroundColor: n.bg, borderColor: n.border }]}>
                <Ionicons name={n.icon} size={22} color={n.color} />
              </View>
              <View style={styles.notifBody}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifText}>{n.body}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 12, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 2 },
  backBtnText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  notifCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  notifIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notifBody: { flex: 1, gap: 4 },
  notifTitle: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700' },
  notifText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 18 },
  notifTime: { color: AppColors.textMuted, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { color: AppColors.textSecondary, fontSize: 14 },
});
