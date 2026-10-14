import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Accelerometer } from 'expo-sensors';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

export default function PermissionsScreen() {
  const [granted, setGranted] = useState<Record<string, boolean>>({
    location: false,
    motion: true,
    camera: false,
  });

  useEffect(() => {
    async function checkExisting() {
      try {
        const loc = await Location.getForegroundPermissionsAsync();
        const cam = await ImagePicker.getCameraPermissionsAsync();
        const imu = await Accelerometer.isAvailableAsync().catch(() => true);
        setGranted({
          location: loc.status === 'granted',
          motion: imu,
          camera: cam.status === 'granted',
        });
      } catch {}
    }
    checkExisting();
  }, []);

  const handleToggle = async (id: string) => {
    if (id === 'location') {
      const res = await Location.requestForegroundPermissionsAsync();
      setGranted((g) => ({ ...g, location: res.status === 'granted' }));
    } else if (id === 'camera') {
      const res = await ImagePicker.requestCameraPermissionsAsync();
      setGranted((g) => ({ ...g, camera: res.status === 'granted' }));
    } else if (id === 'motion') {
      setGranted((g) => ({ ...g, motion: !g.motion }));
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/sensor-check');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Sensor & Device Permissions</Text>
          <Text style={styles.subtitle}>
            RoadPulse needs live accelerometer and GPS access to detect road shocks and geotag hazards in real time.
          </Text>
        </View>

        {/* Location Row */}
        <View style={styles.row}>
          <View style={styles.permIconBox}>
            <Ionicons name="navigate-outline" size={22} color={AppColors.primary} />
          </View>
          <View style={styles.permInfo}>
            <View style={styles.permTitleRow}>
              <Text style={styles.permTitle}>Precise GPS Location</Text>
              <View style={styles.reqBadge}>
                <Text style={styles.reqText}>Required</Text>
              </View>
            </View>
            <Text style={styles.permDesc}>
              Records speed and exact coordinates of pothole shock events.
            </Text>
          </View>
          <Switch
            value={!!granted.location}
            onValueChange={() => handleToggle('location')}
            trackColor={{ false: AppColors.border, true: AppColors.primary }}
            thumbColor={AppColors.surface}
          />
        </View>

        {/* Accelerometer Row */}
        <View style={styles.row}>
          <View style={styles.permIconBox}>
            <Ionicons name="pulse-outline" size={22} color={AppColors.primary} />
          </View>
          <View style={styles.permInfo}>
            <View style={styles.permTitleRow}>
              <Text style={styles.permTitle}>Accelerometer & IMU</Text>
              <View style={styles.reqBadge}>
                <Text style={styles.reqText}>Required</Text>
              </View>
            </View>
            <Text style={styles.permDesc}>
              Continuously measures vertical g-force displacement (20 Hz).
            </Text>
          </View>
          <Switch
            value={!!granted.motion}
            onValueChange={() => handleToggle('motion')}
            trackColor={{ false: AppColors.border, true: AppColors.primary }}
            thumbColor={AppColors.surface}
          />
        </View>

        {/* Camera Row */}
        <View style={styles.row}>
          <View style={styles.permIconBox}>
            <Ionicons name="camera-outline" size={22} color={AppColors.primary} />
          </View>
          <View style={styles.permInfo}>
            <View style={styles.permTitleRow}>
              <Text style={styles.permTitle}>Road Camera Access</Text>
              <View style={styles.optBadge}>
                <Text style={styles.optText}>Optional</Text>
              </View>
            </View>
            <Text style={styles.permDesc}>
              Snaps road surface evidence to fuse with vibration events.
            </Text>
          </View>
          <Switch
            value={!!granted.camera}
            onValueChange={() => handleToggle('camera')}
            trackColor={{ false: AppColors.border, true: AppColors.primary }}
            thumbColor={AppColors.surface}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color={AppColors.primary} />
          <Text style={styles.infoText}>
            Readings remain anonymized. Data packets only transmit during an active drive or upon manual submission.
          </Text>
        </View>

        <Button
          title="Verify Sensor Calibration"
          variant="primary"
          size="lg"
          fullWidth
          icon="arrow-forward"
          iconPosition="right"
          onPress={handleContinue}
          style={{ marginTop: 8, marginBottom: 20 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 22, gap: 14 },
  header: { gap: 6, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: AppColors.textPrimary, letterSpacing: -0.5 },
  subtitle: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  permIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  permInfo: { flex: 1, gap: 3 },
  permTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permTitle: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700' },
  reqBadge: {
    backgroundColor: AppColors.dangerBg,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: AppColors.dangerBorder,
  },
  reqText: { color: AppColors.danger, fontSize: 9, fontWeight: '800' },
  optBadge: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  optText: { color: AppColors.textSecondary, fontSize: 9, fontWeight: '700' },
  permDesc: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 16 },
  infoBox: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: { color: AppColors.textPrimary, fontSize: 12, lineHeight: 18, flex: 1, fontWeight: '500' },
});
