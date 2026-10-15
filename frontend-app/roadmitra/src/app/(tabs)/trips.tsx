import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
  const [savedCount, setSavedCount] = useState(0);

  const loadTrips = useCallback(async () => {
    const saved = await storage.getTrips();
    const validSaved = (saved || []).filter((t) => Boolean(t && t.id));
    setSavedCount(validSaved.length);
    const validMock = MOCK_TRIPS.filter((t) => Boolean(t && t.id));
    if (validSaved.length > 0) {
      setTrips([...validSaved, ...validMock]);
    } else {
      setTrips(validMock);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const handleDeleteTrip = (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to remove this trip?',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storage.deleteTrip(tripId);
            await loadTrips();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleClearSavedTrips = () => {
    Alert.alert(
      'Clear Stored Drives',
      'Delete all your recorded trips from local storage?',
      [
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await storage.saveTrips([]);
            await loadTrips();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

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
        <View>
          <Text style={styles.title}>Trip History</Text>
          <Text style={styles.subTitle}>
            {trips.length} drives recorded · Telemetry synchronized
          </Text>
        </View>
        {savedCount > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearSavedTrips}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-bin-outline" size={14} color={AppColors.danger} />
            <Text style={styles.clearBtnText}>Clear Mine</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={trips}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const upload = UPLOAD_CONFIG[item.uploadStatus] || UPLOAD_CONFIG.pending;
          const isUserSaved = !item.id.startsWith('trip-00');
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.uploadBadge, { backgroundColor: upload.bg, borderColor: upload.border }]}>
                    <Ionicons name={upload.icon} size={12} color={upload.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.uploadLabel, { color: upload.color }]}>
                      {upload.label}
                    </Text>
                  </View>
                  {isUserSaved && (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteTrip(item.id);
                      }}
                      style={styles.deleteIconBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={AppColors.danger} />
                    </TouchableOpacity>
                  )}
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

              {/* Scanned Defect Thumbnail Strip */}
              {item.images && item.images.length > 0 && (
                <View style={styles.imagePreviewRow}>
                  <View style={styles.thumbsContainer}>
                    {item.images.slice(0, 3).map((img, idx) => (
                      <Image key={img.id || idx} source={{ uri: img.uri }} style={styles.tripThumb} />
                    ))}
                    {item.images.length > 3 && (
                      <View style={styles.tripThumbMore}>
                        <Text style={styles.tripThumbMoreText}>+{item.images.length - 3}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.scansBadge}>
                    <Ionicons name="scan-outline" size={13} color={AppColors.primary} />
                    <Text style={styles.scansBadgeText}>
                      {item.images.length} Road Defect Scan{item.images.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subTitle: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: AppColors.cardAlt,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  clearBtnText: {
    color: AppColors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteIconBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: AppColors.cardAlt,
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
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  thumbsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  tripThumbMore: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  tripThumbMoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
  scansBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  scansBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
  },
});
