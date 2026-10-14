import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MOCK_HAZARDS, Hazard } from '../../services/mockData';
import { storage } from '../../services/storage';
import { HAZARD_LABELS, HAZARD_VECTOR_ICONS } from '../../constants/hazardTypes';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LeafletMap } from '../../components/LeafletMap';

const DEFAULT_COORDS = {
  latitude: 18.9388,
  longitude: 72.8354,
};

type FilterType = 'all' | 'camera' | 'phone' | 'both';

export default function MapScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [hazards, setHazards] = useState<Hazard[]>(MOCK_HAZARDS);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [userLocation, setUserLocation] = useState(DEFAULT_COORDS);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const loadHazards = useCallback(async () => {
    try {
      const storedHazards = await storage.getHazards();
      if (storedHazards && storedHazards.length > 0) {
        // Real hazards take priority at the top of the radar
        const storedIds = new Set(storedHazards.map((h) => h.id));
        const remainingMock = MOCK_HAZARDS.filter((h) => !storedIds.has(h.id));
        setHazards([...storedHazards, ...remainingMock]);
      } else {
        setHazards(MOCK_HAZARDS);
      }
    } catch (err) {
      console.warn('Failed loading stored hazards:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHazards();
    }, [loadHazards])
  );

  useEffect(() => {
    async function getUserLocation() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            setUserLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        }
      } catch {}
    }
    getUserLocation();
  }, []);

  const filtered = hazards.filter((h) =>
    filter === 'all' ? true : h.source === filter,
  );

  const handleRecenter = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Top Header Row with View Mode Toggle */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.pageTitle}>Hazard Radar</Text>
            <Text style={styles.pageSub}>
              {filtered.length} defect clusters detected nearby
            </Text>
          </View>
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons
                name="map"
                size={16}
                color={viewMode === 'map' ? AppColors.surface : AppColors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? AppColors.surface : AppColors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <TouchableOpacity
              style={[styles.filterBtn, filter === 'all' && styles.filterActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All Evidence
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterBtn, filter === 'both' && styles.filterActive]}
              onPress={() => setFilter('both')}
            >
              <Ionicons
                name="git-merge-outline"
                size={14}
                color={filter === 'both' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.filterText, filter === 'both' && styles.filterTextActive]}>
                Fused (Vision + IMU)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterBtn, filter === 'camera' && styles.filterActive]}
              onPress={() => setFilter('camera')}
            >
              <Ionicons
                name="camera-outline"
                size={14}
                color={filter === 'camera' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.filterText, filter === 'camera' && styles.filterTextActive]}>
                Vision AI
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterBtn, filter === 'phone' && styles.filterActive]}
              onPress={() => setFilter('phone')}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color={filter === 'phone' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.filterText, filter === 'phone' && styles.filterTextActive]}>
                Phone Telemetry
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Main Content: Map or List View */}
        {viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            <LeafletMap
              hazards={filtered}
              center={userLocation}
              zoom={14}
              onSelectHazard={(h) => setSelectedHazard(h)}
            />

            {/* Floating Recenter Button */}
            <TouchableOpacity
              style={styles.recenterBtn}
              onPress={handleRecenter}
              activeOpacity={0.85}
            >
              <Ionicons name="locate" size={20} color={AppColors.primary} />
            </TouchableOpacity>

            {/* Selected Hazard Card Callout */}
            {selectedHazard && (
              <View style={styles.calloutCard}>
                <View style={styles.calloutHeader}>
                  <View style={styles.calloutIconBox}>
                    <MaterialCommunityIcons
                      name={HAZARD_VECTOR_ICONS[selectedHazard.type] || 'alert-circle'}
                      size={22}
                      color={AppColors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calloutTitle}>
                      {HAZARD_LABELS[selectedHazard.type] || 'Road Defect'}
                    </Text>
                    <Text style={styles.calloutSub}>
                      {Math.round(selectedHazard.confidence * 100)}% Fused Confidence · {selectedHazard.deviceCount} report{selectedHazard.deviceCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedHazard(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color={AppColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedHazard.description && (
                  <Text style={styles.calloutDesc} numberOfLines={2}>
                    {selectedHazard.description}
                  </Text>
                )}

                {selectedHazard.magnitude && (
                  <View style={styles.calloutShock}>
                    <Ionicons name="flash" size={15} color={AppColors.accent} />
                    <Text style={styles.calloutShockText}>
                      {selectedHazard.magnitude}G Road Shock Recorded
                      {selectedHazard.speedKmh ? ` at ${Math.round(selectedHazard.speedKmh)} km/h` : ''}
                    </Text>
                  </View>
                )}

                {selectedHazard.photoUri && (
                  <Image
                    source={{ uri: selectedHazard.photoUri }}
                    style={styles.calloutPhoto}
                    resizeMode="cover"
                  />
                )}

                <Button
                  title="Inspect Confidence & Scores"
                  variant="primary"
                  size="sm"
                  icon="analytics-outline"
                  onPress={() => router.push(`/hazard/${selectedHazard.id}`)}
                />
              </View>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {filtered.map((h) => {
              const confidencePct = Math.round(h.confidence * 100);
              const confidenceColor =
                h.confidence >= 0.75
                  ? AppColors.success
                  : h.confidence >= 0.5
                  ? AppColors.warning
                  : AppColors.danger;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={styles.hazardCard}
                  onPress={() => router.push(`/hazard/${h.id}`)}
                  activeOpacity={0.85}
                >
                  {h.photoUri ? (
                    <Image source={{ uri: h.photoUri }} style={styles.listThumb} />
                  ) : (
                    <View style={styles.calloutIconBox}>
                      <MaterialCommunityIcons
                        name={HAZARD_VECTOR_ICONS[h.type] || 'alert-circle'}
                        size={22}
                        color={AppColors.primary}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.calloutTitle}>{HAZARD_LABELS[h.type]}</Text>
                    <Text style={styles.calloutSub}>
                      {h.source === 'both'
                        ? 'Vision AI + Phone IMU'
                        : h.source === 'camera'
                        ? 'Vision AI Photo'
                        : 'Phone Accelerometer'}
                      {' · '}{h.deviceCount} device{h.deviceCount !== 1 ? 's' : ''}
                    </Text>
                    {h.magnitude && (
                      <Text style={styles.shockListText}>
                        ⚡ {h.magnitude}G shock {h.speedKmh ? `@ ${Math.round(h.speedKmh)} km/h` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.confidenceNum, { color: confidenceColor }]}>
                      {confidencePct}%
                    </Text>
                    <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  container: { flex: 1, backgroundColor: AppColors.bg },
  headerBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.bg,
  },
  pageTitle: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  pageSub: { color: AppColors.textSecondary, fontSize: 12, marginTop: 1 },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: AppColors.primary,
  },
  filtersWrapper: {
    paddingVertical: 6,
    backgroundColor: AppColors.bg,
  },
  filters: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterBtn: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: AppColors.surface,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  recenterBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  calloutCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 20,
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calloutIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  calloutTitle: { color: AppColors.textPrimary, fontSize: 15, fontWeight: '700' },
  calloutSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 4 },
  calloutDesc: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 17 },
  listContainer: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  hazardCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  confidenceNum: { fontSize: 16, fontWeight: '800' },
  confidenceLabel: { color: AppColors.textMuted, fontSize: 9, fontWeight: '700' },
  calloutShock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF1EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD4CC',
  },
  calloutShockText: {
    color: AppColors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  calloutPhoto: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  listThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  shockListText: {
    color: AppColors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
