import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MOCK_HAZARDS, Hazard } from '../../services/mockData';
import { HAZARD_LABELS, HAZARD_VECTOR_ICONS } from '../../constants/hazardTypes';
import { HazardPin } from '../../components/ui/HazardPin';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

const DEFAULT_REGION = {
  latitude: 18.9388,
  longitude: 72.8354,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

type FilterType = 'all' | 'camera' | 'phone' | 'both';

export default function MapScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [hazards, setHazards] = useState<Hazard[]>(MOCK_HAZARDS);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [userRegion, setUserRegion] = useState(DEFAULT_REGION);

  useEffect(() => {
    async function getUserLocation() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (loc?.coords) {
            setUserRegion({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.045,
              longitudeDelta: 0.045,
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

  if (Platform.OS === 'web') {
    return (
      <WebMapFallback
        hazards={filtered}
        filter={filter}
        setFilter={setFilter}
        onSelect={(h) => router.push(`/hazard/${h.id}`)}
      />
    );
  }

  return (
    <NativeMap
      hazards={filtered}
      filter={filter}
      setFilter={setFilter}
      selectedHazard={selectedHazard}
      setSelectedHazard={setSelectedHazard}
      region={userRegion}
    />
  );
}

function NativeMap({
  hazards,
  filter,
  setFilter,
  selectedHazard,
  setSelectedHazard,
  region,
}: {
  hazards: Hazard[];
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  selectedHazard: Hazard | null;
  setSelectedHazard: (h: Hazard | null) => void;
  region: typeof DEFAULT_REGION;
}) {
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);

  useEffect(() => {
    import('react-native-maps')
      .then((mod) => {
        setMapView(() => mod.default);
        setMarker(() => mod.Marker);
      })
      .catch(() => {});
  }, []);

  if (!MapView || !Marker) {
    return (
      <WebMapFallback
        hazards={hazards}
        filter={filter}
        setFilter={setFilter}
        onSelect={(h) => router.push(`/hazard/${h.id}`)}
      />
    );
  }

  const MV = MapView as React.ElementType;
  const MK = Marker as React.ElementType;

  return (
    <View style={styles.container}>
      <MV style={styles.map} initialRegion={region}>
        {hazards.map((h) => (
          <MK
            key={h.id}
            coordinate={{ latitude: h.lat, longitude: h.lon }}
            onPress={() => setSelectedHazard(h)}
          >
            <HazardPin type={h.type} confidence={h.confidence} />
          </MK>
        ))}
      </MV>

      {/* Modern Filter Chips */}
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

      {/* Selected Hazard Card */}
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
                {Math.round(selectedHazard.confidence * 100)}% Fused Confidence · {selectedHazard.deviceCount} reporting devices
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
  );
}

function WebMapFallback({
  hazards,
  filter,
  setFilter,
  onSelect,
}: {
  hazards: Hazard[];
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  onSelect: (h: Hazard) => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.webHeader}>
          <Text style={styles.webTitle}>Nearby Hazard Radar</Text>
          <Text style={styles.webSubtitle}>Live geo-clustered road surface hazards</Text>
        </View>

        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', 'both', 'camera', 'phone'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === 'all'
                    ? 'All'
                    : f === 'both'
                    ? 'Fused'
                    : f === 'camera'
                    ? 'Vision AI'
                    : 'Phone IMU'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={styles.webList}>
          {hazards.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={styles.webCard}
              onPress={() => onSelect(h)}
              activeOpacity={0.8}
            >
              <View style={styles.calloutIconBox}>
                <MaterialCommunityIcons
                  name={HAZARD_VECTOR_ICONS[h.type] || 'alert-circle'}
                  size={20}
                  color={AppColors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutTitle}>{HAZARD_LABELS[h.type]}</Text>
                <Text style={styles.calloutSub}>
                  {Math.round(h.confidence * 100)}% Confidence · {h.deviceCount} report{h.deviceCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={AppColors.textMuted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  container: { flex: 1, backgroundColor: AppColors.bg },
  map: { flex: 1 },
  filtersWrapper: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 10,
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
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
  calloutCard: {
    position: 'absolute',
    bottom: 24,
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
  },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calloutIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTitle: { color: AppColors.textPrimary, fontSize: 15, fontWeight: '700' },
  calloutSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 4 },
  calloutDesc: { color: AppColors.textSecondary, fontSize: 12, lineHeight: 17 },
  webHeader: { padding: 18, paddingBottom: 6 },
  webTitle: { color: AppColors.textPrimary, fontSize: 24, fontWeight: '800' },
  webSubtitle: { color: AppColors.textSecondary, fontSize: 13, marginTop: 2 },
  webList: { padding: 16, gap: 10 },
  webCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
