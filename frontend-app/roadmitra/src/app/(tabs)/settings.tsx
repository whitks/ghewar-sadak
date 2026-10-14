import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../../services/storage';
import { API_BASE_URL } from '../../constants/api';
import { AppColors } from '../../constants/theme';
import { Card } from '../../components/ui/Card';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    autoUpload: true,
    backgroundTracking: false,
    sensorSensitivity: 0.7,
    speedUnit: 'kmh' as 'kmh' | 'mph',
  });

  useEffect(() => {
    storage.getSettings().then((s) => setSettings(s as typeof settings));
  }, []);

  const update = async (key: string, value: unknown) => {
    const next = { ...settings, [key]: value };
    setSettings(next as typeof settings);
    await storage.saveSettings(next);
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Local Data',
      'This will delete all stored trips and queued uploads on this device. This cannot be undone.',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAll();
            Alert.alert('Done', 'Local trip history and upload cache cleared.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* General */}
        <Text style={styles.sectionTitle}>General Preferences</Text>
        <Card variant="elevated">
          <SettingRow
            icon="speedometer-outline"
            label="Speed Unit"
            value={settings.speedUnit === 'kmh' ? 'km/h' : 'mph'}
            onPress={() => update('speedUnit', settings.speedUnit === 'kmh' ? 'mph' : 'kmh')}
          />
        </Card>

        {/* Upload */}
        <Text style={styles.sectionTitle}>Data Transmission</Text>
        <Card variant="elevated">
          <ToggleRow
            icon="cloud-upload-outline"
            label="Auto Sync Telemetry"
            desc="Upload recorded data when connected to network"
            value={settings.autoUpload}
            onChange={(v) => update('autoUpload', v)}
          />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/upload-queue')}>
            <View style={styles.rowLeft}>
              <Ionicons name="layers-outline" size={18} color={AppColors.primary} />
              <Text style={styles.rowLabel}>Offline Upload Queue</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Sensors */}
        <Text style={styles.sectionTitle}>Hardware & Sensors</Text>
        <Card variant="elevated">
          <ToggleRow
            icon="navigate-outline"
            label="Background Trip Tracking"
            desc="Continue recording telemetry when app is minimized"
            value={settings.backgroundTracking}
            onChange={(v) => update('backgroundTracking', v)}
          />
          <TouchableOpacity style={styles.row} onPress={() => router.push('/calibration')}>
            <View style={styles.rowLeft}>
              <Ionicons name="phone-portrait-outline" size={18} color={AppColors.primary} />
              <Text style={styles.rowLabel}>Docking & Calibration Guide</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/diagnostics')}>
            <View style={styles.rowLeft}>
              <Ionicons name="pulse-outline" size={18} color={AppColors.primary} />
              <Text style={styles.rowLabel}>Live Sensor Telemetry Diagnostics</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Privacy */}
        <Text style={styles.sectionTitle}>Privacy & Storage</Text>
        <Card variant="elevated">
          <TouchableOpacity style={styles.row} onPress={() => router.push('/data-privacy')}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={AppColors.primary} />
              <Text style={styles.rowLabel}>Data Sovereignty & Privacy Controls</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.dangerRow]} onPress={handleClearData}>
            <View style={styles.rowLeft}>
              <Ionicons name="trash-outline" size={18} color={AppColors.danger} />
              <Text style={styles.dangerLabel}>Clear Local History & Cache</Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Text style={styles.sectionTitle}>System Information</Text>
        <Card variant="elevated">
          <TouchableOpacity style={styles.row} onPress={() => router.push('/help')}>
            <View style={styles.rowLeft}>
              <Ionicons name="help-circle-outline" size={18} color={AppColors.primary} />
              <Text style={styles.rowLabel}>Troubleshooting FAQ & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
          </TouchableOpacity>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0 (RoadPulse Production)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ingestion Engine</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{API_BASE_URL}</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <View style={styles.rowLeft}>
          <Ionicons name={icon} size={18} color={AppColors.primary} />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: AppColors.border, true: AppColors.primary }}
        thumbColor={AppColors.surface}
      />
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={AppColors.primary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.settingValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={14} color={AppColors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 10, paddingBottom: 40 },
  pageTitle: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  sectionTitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
    gap: 12,
  },
  toggleInfo: { flex: 1, gap: 3 },
  toggleDesc: { color: AppColors.textSecondary, fontSize: 11, lineHeight: 15, paddingLeft: 28 },
  dangerRow: { borderBottomWidth: 0 },
  dangerLabel: { color: AppColors.danger, fontSize: 14, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.borderLight,
  },
  infoLabel: { color: AppColors.textSecondary, fontSize: 13 },
  infoValue: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700', maxWidth: 180 },
});
