import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Trip, storage } from '../../services/storage';
import { MOCK_TRIPS } from '../../services/mockData';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TripSummaryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    async function loadTrip() {
      const storedTrips = await storage.getTrips();
      const validStored = (storedTrips || []).filter((t): t is Trip => Boolean(t && t.id));
      const matched = (id ? validStored.find((t) => t?.id === id) : null) || validStored[0];
      if (matched) {
        setTrip(matched);
      } else {
        const validMocks = MOCK_TRIPS.filter((t): t is Trip => Boolean(t && t.id));
        const mock = (id ? validMocks.find((t) => t?.id === id) : null) || validMocks[0] || null;
        setTrip(mock);
      }
    }
    loadTrip();
  }, [id]);

  const activeTrip: Trip = trip ?? {
    id: `trip-${Date.now()}`,
    startTime: new Date().toISOString(),
    duration: 600,
    distanceKm: 3.2,
    eventCount: 4,
    reportCount: 0,
    uploadStatus: 'done',
    points: [],
  };

  const uploadColor =
    activeTrip.uploadStatus === 'done'
      ? AppColors.success
      : activeTrip.uploadStatus === 'failed'
      ? AppColors.danger
      : AppColors.warning;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Trip Summary</Text>
        </View>

        {/* Hero date & route badge */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="navigate" size={28} color={AppColors.primary} />
          </View>
          <Text style={styles.heroDate}>
            {new Date(activeTrip.startTime).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          <Text style={styles.heroSub}>Road surface telemetry successfully compiled</Text>
        </View>

        {/* Stats 2x2 Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <StatCard
              title="Distance"
              value={activeTrip.distanceKm ? activeTrip.distanceKm.toFixed(1) : '0.0'}
              unit="km"
              icon="speedometer-outline"
              variant="default"
            />
            <StatCard
              title="Duration"
              value={activeTrip.duration ? formatDuration(activeTrip.duration) : '0m'}
              icon="time-outline"
              variant="default"
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              title="Road Shocks"
              value={activeTrip.eventCount ?? activeTrip.events ?? 0}
              icon="pulse-outline"
              variant={activeTrip.eventCount ? 'warning' : 'default'}
              subtitle="Potholes / bumps felt"
            />
            <StatCard
              title="Manual Reports"
              value={activeTrip.reportCount ?? 0}
              icon="camera-outline"
              variant="default"
              subtitle="Photos attached"
            />
          </View>
        </View>

        {/* Upload Status Card */}
        <Card variant="elevated">
          <Text style={styles.uploadLabel}>Cloud Sync Status</Text>
          <View style={styles.uploadRow}>
            <Ionicons
              name={
                activeTrip.uploadStatus === 'done'
                  ? 'checkmark-circle'
                  : activeTrip.uploadStatus === 'failed'
                  ? 'close-circle'
                  : 'cloud-upload-outline'
              }
              size={22}
              color={uploadColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.uploadStatus, { color: uploadColor }]}>
                {activeTrip.uploadStatus === 'done'
                  ? 'Telemetry synced to RoadPulse server'
                  : activeTrip.uploadStatus === 'failed'
                  ? 'Sync pending — stored in local queue'
                  : 'Queued for upload'}
              </Text>
            </View>
          </View>

          {activeTrip.uploadStatus === 'failed' && (
            <Button
              title="Retry In Upload Queue"
              variant="outline"
              size="sm"
              icon="refresh"
              style={{ marginTop: 10 }}
              onPress={() => router.push('/upload-queue')}
            />
          )}
        </Card>

        {/* Route info */}
        <Card variant="cardAlt">
          <View style={styles.routeHeader}>
            <Ionicons name="map-outline" size={20} color={AppColors.primary} />
            <Text style={styles.routeTitle}>GPS Track Info</Text>
          </View>
          <Text style={styles.routeText}>
            High-precision GPS path recorded. Ready for DBSCAN spatial hazard clustering on server.
          </Text>
        </Card>

        <Button
          title="View Road Condition on Map"
          variant="outline"
          size="lg"
          fullWidth
          icon="map-outline"
          style={{ marginBottom: 10 }}
          onPress={() => router.push('/(tabs)/map')}
        />

        <Button
          title="Back to Home Dashboard"
          variant="primary"
          size="lg"
          fullWidth
          icon="home"
          onPress={() => router.replace('/(tabs)')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  hero: { alignItems: 'center', paddingVertical: 14, gap: 6 },
  heroBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
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
    marginBottom: 4,
  },
  heroDate: { color: AppColors.textPrimary, fontSize: 16, fontWeight: '700' },
  heroSub: { color: AppColors.textSecondary, fontSize: 12, fontWeight: '500' },
  statsGrid: { gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  uploadLabel: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadStatus: { fontSize: 14, fontWeight: '700' },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  routeTitle: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  routeText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 18 },
});
