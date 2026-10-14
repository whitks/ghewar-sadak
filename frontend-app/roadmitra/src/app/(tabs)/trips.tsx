import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Trip, MOCK_TRIPS } from '../../services/mockData';
import { storage } from '../../services/storage';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string | number): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const UPLOAD_CONFIG: Record<
  Trip['uploadStatus'],
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string; label: string }
> = {
  done: {
    icon: 'checkmark-circle',
    color: AppColors.success,
    bg: AppColors.successBg,
    border: AppColors.successBorder,
    label: 'Uploaded',
  },
  pending: {
    icon: 'time-outline',
    color: AppColors.warning,
    bg: AppColors.warningBg,
    border: AppColors.warningBorder,
    label: 'Pending',
  },
  uploading: {
    icon: 'arrow-up-circle',
    color: AppColors.info,
    bg: AppColors.infoBg,
    border: AppColors.infoBorder,
    label: 'Syncing',
  },
  failed: {
    icon: 'alert-circle',
    color: AppColors.danger,
    bg: AppColors.dangerBg,
    border: AppColors.dangerBorder,
    label: 'Failed',
  },
};

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>(MOCK_TRIPS);

  useEffect(() => {
    storage.getTrips().then((saved) => {
      if (saved && saved.length > 0) {
        setTrips([...saved, ...MOCK_TRIPS]);
      }
    });
  }, []);

  if (trips.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="navigate-outline" size={36} color={AppColors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No trips recorded yet</Text>
          <Text style={styles.emptySubtitle}>
            Start your first drive from the Home screen to record road jolts and GPS tracks.
          </Text>
          <Button
            title="Start First Drive"
            variant="primary"
            icon="play-circle"
            onPress={() => router.push('/(tabs)')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip History</Text>
      </View>
      <FlatList
        data={trips}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const upload = UPLOAD_CONFIG[item.uploadStatus] || UPLOAD_CONFIG.pending;
          return (
            <TouchableOpacity
              style={styles.tripCard}
              onPress={() => router.push(`/trip/summary?id=${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.tripHeader}>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={15} color={AppColors.textSecondary} />
                  <Text style={styles.tripDate}>{formatDate(item.startTime)}</Text>
                </View>
                <View style={[styles.uploadBadge, { backgroundColor: upload.bg, borderColor: upload.border }]}>
                  <Ionicons name={upload.icon} size={12} color={upload.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.uploadLabel, { color: upload.color }]}>
                    {upload.label}
                  </Text>
                </View>
              </View>

              <View style={styles.tripStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {item.distanceKm ? item.distanceKm.toFixed(1) : (item.distance ?? 0).toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {item.duration ? formatDuration(item.duration) : '—'}
                  </Text>
                  <Text style={styles.statLabel}>duration</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: (item.eventCount ?? item.events ?? 0) > 0 ? AppColors.accent : AppColors.textPrimary }]}>
                    {item.eventCount ?? item.events ?? 0}
                  </Text>
                  <Text style={styles.statLabel}>shocks</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.reportCount ?? 0}</Text>
                  <Text style={styles.statLabel}>reports</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  list: { padding: 18, gap: 12, paddingTop: 6 },
  tripCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripDate: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700' },
  uploadBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadLabel: { fontSize: 11, fontWeight: '700' },
  tripStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardAlt,
    padding: 12,
    borderRadius: 14,
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { color: AppColors.textPrimary, fontSize: 16, fontWeight: '800' },
  statLabel: {
    color: AppColors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: 24, backgroundColor: AppColors.border },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { color: AppColors.textPrimary, fontSize: 18, fontWeight: '800' },
  emptySubtitle: {
    color: AppColors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
});
