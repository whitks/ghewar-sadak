import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Trip, storage, TripImage } from '../../services/storage';
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
  const [selectedImage, setSelectedImage] = useState<TripImage | null>(null);

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

        {/* AI Vision & Road Defect Gallery */}
        <Card variant="elevated">
          <View style={styles.galleryHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="scan-outline" size={20} color={AppColors.primary} />
              <Text style={styles.galleryTitle}>AI Vision Defect Gallery</Text>
            </View>
            <View style={styles.galleryBadge}>
              <Text style={styles.galleryBadgeText}>
                {activeTrip.images?.length ?? 0} Scanned
              </Text>
            </View>
          </View>
          <Text style={styles.gallerySub}>
            Annotated road frames captured by windshield camera and processed by Fast YOLO
          </Text>

          {activeTrip.images && activeTrip.images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroll}
            >
              {activeTrip.images.map((img, idx) => (
                <TouchableOpacity
                  key={img.id || idx}
                  style={styles.galleryCard}
                  activeOpacity={0.88}
                  onPress={() => setSelectedImage(img)}
                >
                  <View style={styles.galleryCardImgBox}>
                    <Image source={{ uri: img.uri }} style={styles.galleryCardImg} resizeMode="cover" />
                    {img.severity && (
                      <View
                        style={[
                          styles.severityTag,
                          {
                            backgroundColor:
                              img.severity === 'Critical'
                                ? '#ef4444'
                                : img.severity === 'High'
                                ? '#f97316'
                                : '#eab308',
                          },
                        ]}
                      >
                        <Text style={styles.severityTagText}>{img.severity}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.galleryCardInfo}>
                    <Text style={styles.galleryCardDefects} numberOfLines={1}>
                      {img.defects && img.defects.length > 0
                        ? img.defects.join(', ')
                        : img.potholesFound > 0
                        ? `${img.potholesFound} Pothole(s)`
                        : 'Road Scan'}
                    </Text>
                    <View style={styles.galleryCardMeta}>
                      {img.maxDepthCm && (
                        <Text style={styles.galleryCardDepth}>~{img.maxDepthCm}cm depth</Text>
                      )}
                      <Text style={styles.galleryCardTime}>
                        {new Date(img.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noImagesBox}>
              <Ionicons name="shield-checkmark-outline" size={26} color={AppColors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noImagesTitle}>Clean Surface / No Visual Defects</Text>
                <Text style={styles.noImagesSub}>
                  No road damage bounding boxes detected on camera during this trip.
                </Text>
              </View>
            </View>
          )}
        </Card>

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

        {/* Fullscreen Modal Image Inspector */}
        <Modal
          visible={selectedImage !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedImage(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalDialog}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {selectedImage?.defects && selectedImage.defects.length > 0
                      ? selectedImage.defects.join(', ')
                      : 'Road Defect AI Scan'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedImage ? new Date(selectedImage.timestamp).toLocaleTimeString() : ''}
                    {selectedImage?.maxDepthCm ? ` · Estimated Depth: ${selectedImage.maxDepthCm}cm` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {selectedImage && (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}

              <View style={styles.modalFooter}>
                <View style={styles.modalTagRow}>
                  <Text style={styles.modalTag}>Fast YOLO Annotations</Text>
                  {selectedImage?.severity && (
                    <Text style={[styles.modalTag, { color: '#ef4444', borderColor: '#ef4444' }]}>
                      {selectedImage.severity} Severity
                    </Text>
                  )}
                  {selectedImage?.lat && (
                    <Text style={styles.modalTag}>
                      {selectedImage.lat.toFixed(4)}, {selectedImage.lon?.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </Modal>
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
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  galleryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  galleryBadge: {
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  galleryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.primary,
  },
  gallerySub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 12,
  },
  galleryScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  galleryCard: {
    width: 170,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  galleryCardImgBox: {
    width: '100%',
    height: 110,
    backgroundColor: '#000',
    position: 'relative',
  },
  galleryCardImg: {
    width: '100%',
    height: '100%',
  },
  severityTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  galleryCardInfo: {
    padding: 8,
    gap: 4,
  },
  galleryCardDefects: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  galleryCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryCardDepth: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.accent,
  },
  galleryCardTime: {
    fontSize: 10,
    color: AppColors.textSecondary,
  },
  noImagesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppColors.cardAlt,
    padding: 12,
    borderRadius: 12,
  },
  noImagesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  noImagesSub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#18181b',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  modalTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d4d4d8',
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
});
