import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function ReportResultScreen() {
  const params = useLocalSearchParams<{
    accepted?: string;
    duplicates?: string;
    type?: string;
    notice?: string;
  }>();

  const accepted = Number(params.accepted ?? '1');
  const duplicates = Number(params.duplicates ?? '0');
  const hazardType = params.type ?? 'Road Defect';
  const notice = params.notice;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.iconBox}>
            <Ionicons name="checkmark-done" size={40} color={AppColors.success} />
          </View>
          <Text style={styles.heroTitle}>Observation Registered</Text>
          <Text style={styles.heroSubtitle}>
            Your defect report has been verified and queued for spatial clustering with vehicle IMU streams.
          </Text>
        </View>

        <Card variant="elevated">
          <Text style={styles.cardTitle}>Observation Receipt (Contract v2)</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Defect Category</Text>
            <Text style={styles.detailValue}>{hazardType}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Accepted Observations</Text>
            <Text style={[styles.detailValue, { color: AppColors.success }]}>{accepted}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duplicate Filtered</Text>
            <Text style={styles.detailValue}>{duplicates}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Processing Pipeline</Text>
            <Text style={[styles.detailValue, { color: AppColors.info }]}>DBSCAN Clustering</Text>
          </View>
        </Card>

        {notice ? (
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={18} color={AppColors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Server Notice</Text>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          </View>
        ) : null}

        <Card variant="cardAlt">
          <View style={styles.clusteringHeader}>
            <Ionicons name="git-merge-outline" size={16} color={AppColors.primary} />
            <Text style={styles.clusteringTitle}>DBSCAN Spatial Clustering</Text>
          </View>
          <Text style={styles.infoText}>
            Observations within 15–20 m are clustered by DBSCAN. Multiple passes from the same vehicle within 24 hours are merged once to prevent artificial score inflation.
          </Text>
        </Card>

        <Button
          title="Submit Another Report"
          variant="primary"
          size="lg"
          fullWidth
          icon="add-circle-outline"
          onPress={() => router.replace('/(tabs)/report')}
          style={{ marginTop: 8 }}
        />

        <Button
          title="Back to Home Dashboard"
          variant="outline"
          size="lg"
          fullWidth
          icon="home-outline"
          onPress={() => router.replace('/(tabs)')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 22, gap: 14, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  iconBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: AppColors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.successBorder,
  },
  heroTitle: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { color: AppColors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 },
  cardTitle: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { color: AppColors.textSecondary, fontSize: 13 },
  detailValue: { color: AppColors.textPrimary, fontSize: 14, fontWeight: '700' },
  noticeBox: {
    backgroundColor: AppColors.warningBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.warningBorder,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noticeTitle: { color: AppColors.warning, fontSize: 12, fontWeight: '800' },
  noticeText: { color: AppColors.warning, fontSize: 12, lineHeight: 17, marginTop: 2 },
  clusteringHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  clusteringTitle: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
  infoText: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 18 },
});
