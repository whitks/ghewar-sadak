import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { AppColors } from '../constants/theme';
import { Button } from '../components/ui/Button';

export default function UploadQueueScreen() {
  const { queue, uploading, uploadAll } = useUploadQueue();
  const pending = queue.filter((i) => i.status !== 'done');

  const STATUS: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string; label: string }
  > = {
    pending: {
      icon: 'time-outline',
      color: AppColors.warning,
      bg: AppColors.warningBg,
      border: AppColors.warningBorder,
      label: 'Queued',
    },
    uploading: {
      icon: 'arrow-up-circle',
      color: AppColors.info,
      bg: AppColors.infoBg,
      border: AppColors.infoBorder,
      label: 'Uploading…',
    },
    done: {
      icon: 'checkmark-circle',
      color: AppColors.success,
      bg: AppColors.successBg,
      border: AppColors.successBorder,
      label: 'Synced',
    },
    failed: {
      icon: 'close-circle',
      color: AppColors.danger,
      bg: AppColors.dangerBg,
      border: AppColors.dangerBorder,
      label: 'Failed',
    },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Upload Queue</Text>
        {pending.length > 0 && (
          <Button
            title="Upload All"
            variant="primary"
            size="sm"
            loading={uploading}
            icon="cloud-upload-outline"
            onPress={uploadAll}
          />
        )}
      </View>

      {pending.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="checkmark-done" size={42} color={AppColors.success} />
          </View>
          <Text style={styles.emptyTitle}>All Telemetry Synced</Text>
          <Text style={styles.emptySubtitle}>
            All road vibration samples and GPS traces have been successfully transmitted to the server.
          </Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const s = STATUS[item.status] || STATUS.pending;
            const dateStr =
              typeof item.createdAt === 'number'
                ? new Date(item.createdAt).toLocaleTimeString()
                : String(item.createdAt);
            return (
              <View style={styles.queueItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemType}>{item.type.toUpperCase()} PAYLOAD</Text>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
                    <Ionicons name={s.icon} size={13} color={s.color} style={{ marginRight: 4 }} />
                    <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>
                <Text style={styles.itemId} numberOfLines={1}>{item.id}</Text>
                <Text style={styles.itemDate}>Created: {dateStr}</Text>
                {(item.retries ?? item.attempts ?? 0) > 0 && (
                  <Text style={styles.retries}>Attempts: {item.retries ?? item.attempts}</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  backBtn: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', flex: 1, letterSpacing: -0.5 },
  list: { padding: 18, gap: 12 },
  queueItem: {
    backgroundColor: AppColors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemType: { color: AppColors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  itemId: { color: AppColors.textPrimary, fontSize: 13, fontWeight: '700' },
  itemDate: { color: AppColors.textMuted, fontSize: 11 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  retries: { color: AppColors.danger, fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIconBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: AppColors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AppColors.successBorder,
  },
  emptyTitle: { color: AppColors.textPrimary, fontSize: 20, fontWeight: '800' },
  emptySubtitle: {
    color: AppColors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
