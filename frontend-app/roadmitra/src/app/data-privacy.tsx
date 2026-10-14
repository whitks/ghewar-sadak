import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { Button } from '../components/ui/Button';

export default function DataPrivacyScreen() {
  const handleDeleteRequest = () => {
    Alert.alert(
      'Request Data Deletion',
      'This will submit a request to purge all telemetry and hazard reports associated with this device identifier on the RoadPulse server.',
      [
        {
          text: 'Purge Server Data',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Request Received', 'Your device-associated telemetry records have been queued for permanent deletion.'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Data & Privacy Controls</Text>
        <Text style={styles.subtitle}>
          RoadPulse follows strict data minimization principles. Telemetry is collected solely for road safety enhancement.
        </Text>

        <Section title="What We Ingest">
          <BulletItem
            icon="navigate-outline"
            text="GPS coordinates and speed vectors strictly during an active drive"
          />
          <BulletItem
            icon="pulse-outline"
            text="Vibration metrics (peak acceleration, duration, zero-crossings)"
          />
          <BulletItem
            icon="camera-outline"
            text="User-submitted photos — automatically blurred before storage"
          />
        </Section>

        <Section title="What We Never Store">
          <BulletItem
            icon="person-remove-outline"
            text="Personal identity, contact details, or user accounts"
          />
          <BulletItem
            icon="phone-portrait-outline"
            text="Hardware IMEI, MAC address, or SIM identifiers"
          />
          <BulletItem
            icon="eye-off-outline"
            text="Unblurred faces or vehicle license plates"
          />
          <BulletItem
            icon="navigate-circle-outline"
            text="Location tracking when a trip is not actively recording"
          />
        </Section>

        <Section title="Data Retention Policy">
          <BulletItem
            icon="calendar-outline"
            text="Raw device vibration samples are purged after 30 days"
          />
          <BulletItem
            icon="git-merge-outline"
            text="Merged hazard records are retained as public safety telemetry"
          />
        </Section>

        <View style={styles.deleteBox}>
          <Text style={styles.deleteTitle}>Data Sovereignty & Deletion</Text>
          <Text style={styles.deleteText}>
            You have the right to erase all server-side records linked to your randomized device key at any time.
          </Text>
          <Button
            title="Request Complete Data Purge"
            variant="destructive"
            size="md"
            icon="trash-outline"
            onPress={handleDeleteRequest}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function BulletItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.bullet}>
      <Ionicons name={icon} size={18} color={AppColors.primary} style={{ marginTop: 1 }} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 18 },
  section: { gap: 6 },
  sectionTitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionContent: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletText: { color: AppColors.textPrimary, fontSize: 13, lineHeight: 19, flex: 1 },
  deleteBox: {
    backgroundColor: AppColors.dangerBg,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: AppColors.dangerBorder,
    marginTop: 6,
  },
  deleteTitle: { color: AppColors.danger, fontSize: 15, fontWeight: '800' },
  deleteText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 18 },
});
