import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MOCK_HAZARDS, MOCK_TRIPS, Hazard, Trip } from '../../services/mockData';
import { storage } from '../../services/storage';
import { RoadSegment, generateAllRoadSegments } from '../../services/roadSegmentation';
import {
  RoadMemorySegment,
  generateRoadMemorySegments,
  generateSparseRoadLineHazards,
  PCI_COLORS,
  RoadQualityGrade,
} from '../../services/roadMemoryService';
import { HAZARD_LABELS, HAZARD_VECTOR_ICONS } from '../../constants/hazardTypes';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LeafletMap } from '../../components/LeafletMap';
import { tripRecorderService } from '../../services/tripRecorder';

const DEFAULT_COORDS = {
  latitude: 28.6139,
  longitude: 77.2090,
};

type FilterType = 'all' | 'camera' | 'phone' | 'both';
type TableFilterType = 'all' | 'recurring' | 'very_poor' | 'poor' | 'fair' | 'good';

export default function MapScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [roadSegments, setRoadSegments] = useState<RoadSegment[]>([]);
  const [storedTripsList, setStoredTripsList] = useState<Trip[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RoadMemorySegment | RoadSegment | null>(null);
  const [isMemoryModalVisible, setIsMemoryModalVisible] = useState(false);
  
  const initialLiveCoords = tripRecorderService.getTelemetry().coords;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    initialLiveCoords ? { latitude: initialLiveCoords.lat, longitude: initialLiveCoords.lon } : null
  );
  const [isLocating, setIsLocating] = useState(!initialLiveCoords);
  const [viewMode, setViewMode] = useState<'map' | 'table' | 'defects'>('map');
  const [tableFilter, setTableFilter] = useState<TableFilterType>('all');

  const loadHazardsAndRoutes = useCallback(async () => {
    try {
      const storedHazards = await storage.getHazards();
      const storedTrips = await storage.getTrips();
      const deletedIds = new Set(await storage.getDeletedHazardIds());

      const validTrips = (storedTrips || []).filter(
        (t): t is Trip => Boolean(t && t.id && (t.distanceKm === undefined || t.distanceKm >= 0.05))
      );
      setStoredTripsList(validTrips);
      const allTrips = [...validTrips, ...MOCK_TRIPS];

      // Exclude any deleted hazards
      const validStored = (storedHazards || []).filter((h) => Boolean(h && h.id && !deletedIds.has(h.id)));

      // Generate a small, sparse set of defect points situated directly on the road corridor lines
      const center = userLocation || DEFAULT_COORDS;
      const lineHazards = generateSparseRoadLineHazards(center, deletedIds);

      const storedIds = new Set(validStored.map((h) => h.id));
      const remainingLine = lineHazards.filter((h) => !storedIds.has(h.id));
      const allHazards = [...validStored, ...remainingLine];

      setHazards(allHazards);

      // Segment continuous visited roads into ~100m slices colored by safety severity
      const segments = generateAllRoadSegments(allTrips, allHazards);
      setRoadSegments(segments);
    } catch (err) {
      console.warn('Failed loading stored hazards and routes:', err);
    }
  }, [userLocation]);

  useFocusEffect(
    useCallback(() => {
      loadHazardsAndRoutes();
    }, [loadHazardsAndRoutes])
  );

  useEffect(() => {
    let isMounted = true;
    async function resolveLocation() {
      try {
        if (!userLocation) {
          const cached = await storage.getLastLocation();
          if (cached && isMounted) {
            setUserLocation(cached);
            setIsLocating(false);
          }
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
          if (lastKnown?.coords && isMounted) {
            const coords = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            setUserLocation(coords);
            setIsLocating(false);
            storage.saveLastLocation(coords).catch(() => {});
          }

          const fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          if (fresh?.coords && isMounted) {
            const coords = {
              latitude: fresh.coords.latitude,
              longitude: fresh.coords.longitude,
            };
            setUserLocation(coords);
            setIsLocating(false);
            storage.saveLastLocation(coords).catch(() => {});
          }
        } else {
          if (isMounted) {
            setUserLocation((prev) => prev ?? DEFAULT_COORDS);
            setIsLocating(false);
          }
        }
      } catch {
        if (isMounted) {
          setUserLocation((prev) => prev ?? DEFAULT_COORDS);
          setIsLocating(false);
        }
      }
    }
    resolveLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  // Dynamically generate Road Memory recurring damage simulation surrounding user's live position
  const memorySegments = useMemo(() => {
    const center = userLocation || DEFAULT_COORDS;
    return generateRoadMemorySegments(center, hazards, storedTripsList);
  }, [userLocation, hazards, storedTripsList]);

  // Combined road segments shown on the Leaflet map
  const displaySegments = useMemo(() => {
    return [...memorySegments, ...roadSegments];
  }, [memorySegments, roadSegments]);

  // Road Memory & PCI Analytics metrics
  const avgPci = useMemo(() => {
    if (memorySegments.length === 0) return 0;
    const sum = memorySegments.reduce((acc, s) => acc + s.pciScore, 0);
    return Math.round(sum / memorySegments.length);
  }, [memorySegments]);

  const goodCount = useMemo(
    () => memorySegments.filter((s) => s.quality === 'good').length,
    [memorySegments]
  );
  const fairCount = useMemo(
    () => memorySegments.filter((s) => s.quality === 'fair').length,
    [memorySegments]
  );
  const poorCount = useMemo(
    () => memorySegments.filter((s) => s.quality === 'poor').length,
    [memorySegments]
  );
  const veryPoorCount = useMemo(
    () => memorySegments.filter((s) => s.quality === 'very_poor').length,
    [memorySegments]
  );
  const recurringCount = useMemo(
    () => memorySegments.filter((s) => s.isRecurringHotspot).length,
    [memorySegments]
  );

  const filteredHazards = hazards.filter((h) =>
    filter === 'all' ? true : h.source === filter,
  );

  const filteredTableSegments = useMemo(() => {
    if (tableFilter === 'all') return memorySegments;
    if (tableFilter === 'recurring') return memorySegments.filter((s) => s.isRecurringHotspot);
    return memorySegments.filter((s) => s.quality === tableFilter);
  }, [memorySegments, tableFilter]);

  const handleRecenter = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coords);
        storage.saveLastLocation(coords).catch(() => {});
      }
    } catch {}
  };

  const openSegmentModal = (seg: RoadMemorySegment | RoadSegment) => {
    setSelectedSegment(seg);
    setIsMemoryModalVisible(true);
  };

  const isRoadMemory = (s: any): s is RoadMemorySegment => {
    return Boolean(s && 'pciScore' in s && 'repairHistory' in s);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Top Header Row with 3 View Mode Toggles */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.pageTitle}>Road Memory</Text>
              <View style={styles.prototypeBadge}>
                <Text style={styles.prototypeBadgeText}>PCI Radar</Text>
              </View>
            </View>
            <Text style={styles.pageSub} numberOfLines={1}>
              {memorySegments.length} road segments · {recurringCount} recurring damage hotspots
            </Text>
          </View>

          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons
                name="map"
                size={15}
                color={viewMode === 'map' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.toggleBtnText, viewMode === 'map' && styles.toggleBtnTextActive]}>
                Map
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'table' && styles.toggleBtnActive]}
              onPress={() => setViewMode('table')}
            >
              <Ionicons
                name="grid-outline"
                size={15}
                color={viewMode === 'table' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.toggleBtnText, viewMode === 'table' && styles.toggleBtnTextActive]}>
                PCI Table
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'defects' && styles.toggleBtnActive]}
              onPress={() => setViewMode('defects')}
            >
              <Ionicons
                name="warning-outline"
                size={15}
                color={viewMode === 'defects' ? AppColors.surface : AppColors.primary}
              />
              <Text style={[styles.toggleBtnText, viewMode === 'defects' && styles.toggleBtnTextActive]}>
                Defects
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* PCI Survey & Recurring Damage KPI Strip (Matching Reference Image) */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>SEGMENTS</Text>
            <Text style={styles.kpiValue}>{memorySegments.length}</Text>
          </View>

          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>AVERAGE PCI</Text>
            <View style={styles.pciPill}>
              <View
                style={[
                  styles.pciDot,
                  {
                    backgroundColor:
                      avgPci >= 80 ? PCI_COLORS.good : avgPci >= 60 ? PCI_COLORS.fair : avgPci >= 40 ? PCI_COLORS.poor : PCI_COLORS.very_poor,
                  },
                ]}
              />
              <Text style={styles.kpiValueHighlight}>{avgPci}</Text>
            </View>
          </View>

          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>RECURRING</Text>
            <Text style={[styles.kpiValue, { color: AppColors.accent }]}>{recurringCount}</Text>
          </View>

          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>VERY POOR</Text>
            <Text style={[styles.kpiValue, { color: PCI_COLORS.very_poor }]}>{veryPoorCount}</Text>
          </View>
        </View>

        {/* Condition Severity Color Legend Bar */}
        <View style={styles.legendBar}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.good }]} />
            <Text style={styles.legendText}>Good 80-100 ({goodCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.fair }]} />
            <Text style={styles.legendText}>Fair 60-79 ({fairCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.poor }]} />
            <Text style={styles.legendText}>Poor 40-59 ({poorCount})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.very_poor }]} />
            <Text style={[styles.legendText, { color: PCI_COLORS.very_poor, fontWeight: '800' }]}>
              Very Poor ({veryPoorCount})
            </Text>
          </View>
        </View>

        {/* Main Content Area */}
        {viewMode === 'map' ? (
          <View style={styles.mapContainer}>
            {!userLocation ? (
              <View style={styles.locatingContainer}>
                <View style={styles.locatingPulseBox}>
                  <Ionicons name="navigate" size={30} color={AppColors.primary} />
                </View>
                <Text style={styles.locatingTitle}>Acquiring Live GPS Location...</Text>
                <Text style={styles.locatingSub}>Centering road condition radar on your position</Text>
              </View>
            ) : (
              <>
                <LeafletMap
                  hazards={filteredHazards}
                  roadSegments={displaySegments}
                  center={userLocation}
                  zoom={15}
                  onSelectHazard={(h) => {
                    setSelectedSegment(null);
                    setSelectedHazard(h);
                  }}
                  onSelectSegment={(s) => {
                    setSelectedHazard(null);
                    openSegmentModal(s);
                  }}
                />

                {/* Floating Recenter Button */}
                <TouchableOpacity
                  style={styles.recenterBtn}
                  onPress={handleRecenter}
                  activeOpacity={0.85}
                >
                  <Ionicons name="locate" size={20} color={AppColors.primary} />
                </TouchableOpacity>

                {/* Road Memory Quick Status Chip (Floating on map) */}
                <View style={styles.floatingInfoPill}>
                  <Ionicons name="pulse" size={14} color={AppColors.accent} />
                  <Text style={styles.floatingInfoText}>
                    Simulated Road Memory corridor around your GPS position
                  </Text>
                </View>
              </>
            )}

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

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Inspect Details"
                      variant="primary"
                      size="sm"
                      icon="analytics-outline"
                      onPress={() => router.push(`/hazard/${selectedHazard.id}`)}
                    />
                  </View>
                  <Button
                    title="Delete"
                    variant="destructive"
                    size="sm"
                    icon="trash-outline"
                    onPress={async () => {
                      await storage.deleteHazard(selectedHazard.id);
                      setSelectedHazard(null);
                      await loadHazardsAndRoutes();
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        ) : viewMode === 'table' ? (
          /* Scanned Road Segments Table (Matching Reference Dashboard Image) */
          <View style={styles.tableScreenContainer}>
            {/* Table Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableFilterRow}>
              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'all' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('all')}
              >
                <Text style={[styles.tableFilterText, tableFilter === 'all' && styles.tableFilterTextActive]}>
                  All ({memorySegments.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tableFilterPill,
                  tableFilter === 'recurring' && styles.tableFilterPillActive,
                  { borderColor: AppColors.accent },
                ]}
                onPress={() => setTableFilter('recurring')}
              >
                <Ionicons
                  name="warning"
                  size={12}
                  color={tableFilter === 'recurring' ? AppColors.surface : AppColors.accent}
                />
                <Text style={[styles.tableFilterText, tableFilter === 'recurring' && styles.tableFilterTextActive]}>
                  Recurring Only ({recurringCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'very_poor' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('very_poor')}
              >
                <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.very_poor }]} />
                <Text style={[styles.tableFilterText, tableFilter === 'very_poor' && styles.tableFilterTextActive]}>
                  Very Poor ({veryPoorCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'poor' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('poor')}
              >
                <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.poor }]} />
                <Text style={[styles.tableFilterText, tableFilter === 'poor' && styles.tableFilterTextActive]}>
                  Poor ({poorCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'fair' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('fair')}
              >
                <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.fair }]} />
                <Text style={[styles.tableFilterText, tableFilter === 'fair' && styles.tableFilterTextActive]}>
                  Fair ({fairCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tableFilterPill, tableFilter === 'good' && styles.tableFilterPillActive]}
                onPress={() => setTableFilter('good')}
              >
                <View style={[styles.legendDot, { backgroundColor: PCI_COLORS.good }]} />
                <Text style={[styles.tableFilterText, tableFilter === 'good' && styles.tableFilterTextActive]}>
                  Good ({goodCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Scanned Segments Data Table */}
            <ScrollView style={styles.tableScrollView} showsVerticalScrollIndicator={true}>
              <View style={styles.tableCard}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: 32 }]}>#</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Road Section</Text>
                  <Text style={[styles.tableHeaderCell, { width: 55, textAlign: 'center' }]}>PCI</Text>
                  <Text style={[styles.tableHeaderCell, { width: 50, textAlign: 'center' }]}>Cracks</Text>
                  <Text style={[styles.tableHeaderCell, { width: 50, textAlign: 'center' }]}>Holes</Text>
                  <Text style={[styles.tableHeaderCell, { width: 85, textAlign: 'center' }]}>Recurrence</Text>
                </View>

                {/* Table Rows */}
                {filteredTableSegments.map((seg, idx) => (
                  <TouchableOpacity
                    key={seg.id}
                    style={[
                      styles.tableDataRow,
                      idx % 2 === 1 && styles.tableDataRowAlt,
                      seg.isRecurringHotspot && styles.tableDataRowHotspot,
                    ]}
                    onPress={() => openSegmentModal(seg)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tableDataCell, { width: 32, fontWeight: '700', color: AppColors.textSecondary }]}>
                      {idx + 1}
                    </Text>

                    <View style={{ flex: 1.5, paddingRight: 6 }}>
                      <Text style={styles.tableRoadName} numberOfLines={1}>
                        {seg.roadName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Text style={styles.tableRoadType}>{seg.roadType}</Text>
                        <Text style={styles.tableRoadDist}>· {seg.distanceMeters}m</Text>
                      </View>
                    </View>

                    <View style={{ width: 55, alignItems: 'center' }}>
                      <View style={[styles.tablePciBadge, { backgroundColor: seg.color }]}>
                        <Text style={styles.tablePciBadgeText}>{seg.pciScore}</Text>
                      </View>
                    </View>

                    <Text style={[styles.tableDataCell, { width: 50, textAlign: 'center' }]}>
                      {seg.crackCount}
                    </Text>

                    <Text style={[styles.tableDataCell, { width: 50, textAlign: 'center', fontWeight: '700' }]}>
                      {seg.potholeCount}
                    </Text>

                    <View style={{ width: 85, alignItems: 'center' }}>
                      {seg.isRecurringHotspot ? (
                        <View style={styles.tableRecurrenceBadgeWarn}>
                          <Text style={styles.tableRecurrenceBadgeWarnText}>
                            {seg.recurrenceCount}x Alert
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.tableRecurrenceBadgeOk}>
                          <Text style={styles.tableRecurrenceBadgeOkText}>
                            {seg.recurrenceCount}x Stable
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : (
          /* Individual Hazards & Sensor Defects List */
          <ScrollView contentContainerStyle={styles.listContainer}>
            <View style={styles.defectsActionBar}>
              <Text style={styles.defectsCountLabel}>
                {filteredHazards.length} Road Defect{filteredHazards.length !== 1 ? 's' : ''} on Corridors
              </Text>
              {filteredHazards.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllBtn}
                  onPress={async () => {
                    await storage.clearAllHazards();
                    await loadHazardsAndRoutes();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={13} color="#EF4444" />
                  <Text style={styles.clearAllBtnText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredHazards.length === 0 ? (
              <View style={styles.emptyDefectsBox}>
                <Ionicons name="shield-checkmark-outline" size={42} color={AppColors.success} />
                <Text style={styles.emptyDefectsTitle}>All Defect Points Cleared</Text>
                <Text style={styles.emptyDefectsSub}>
                  No defects logged on this corridor. New defects will appear when detected during Drive Mode.
                </Text>
              </View>
            ) : (
              filteredHazards.map((h) => {
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
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.confidenceNum, { color: confidenceColor }]}>
                          {confidencePct}%
                        </Text>
                        <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteCardBtn}
                        onPress={async (e) => {
                          e.stopPropagation?.();
                          await storage.deleteHazard(h.id);
                          await loadHazardsAndRoutes();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── ROAD MEMORY — RECURRING DAMAGE INSPECTOR MODAL ───────────────── */}
        <Modal
          visible={isMemoryModalVisible && Boolean(selectedSegment)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsMemoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {selectedSegment && (
                <>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time-outline" size={18} color={AppColors.primary} />
                        <Text style={styles.modalCategoryTitle}>ROAD MEMORY INTELLIGENCE</Text>
                      </View>
                      <Text style={styles.modalRoadTitle}>
                        {isRoadMemory(selectedSegment) ? selectedSegment.roadName : 'Surveyed Road Section'}
                      </Text>
                      <Text style={styles.modalRoadSub}>
                        {isRoadMemory(selectedSegment)
                          ? `${selectedSegment.roadType.toUpperCase()} · ${selectedSegment.distanceMeters}m Surveyed`
                          : `~${selectedSegment.distanceMeters}m Section`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsMemoryModalVisible(false)}
                      style={styles.modalCloseBtn}
                    >
                      <Ionicons name="close" size={20} color={AppColors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                    {/* PCI Score Gauge Box */}
                    {isRoadMemory(selectedSegment) && (
                      <View style={styles.pciGaugeBox}>
                        <View style={styles.pciGaugeHeader}>
                          <Text style={styles.pciGaugeLabel}>PAVEMENT CONDITION INDEX (PCI)</Text>
                          <View
                            style={[
                              styles.pciGradeBadge,
                              { backgroundColor: selectedSegment.color },
                            ]}
                          >
                            <Text style={styles.pciGradeBadgeText}>
                              {selectedSegment.quality.replace('_', ' ').toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.pciScoreRow}>
                          <Text style={[styles.pciScoreBig, { color: selectedSegment.color }]}>
                            {selectedSegment.pciScore}
                          </Text>
                          <Text style={styles.pciScoreMax}>/ 100</Text>
                          <Text style={styles.pciScoreDesc}>
                            {selectedSegment.quality === 'good'
                              ? 'Healthy ride quality. No structural repairs required.'
                              : selectedSegment.quality === 'fair'
                              ? 'Moderate aggregate wear. Monitor during monsoon season.'
                              : selectedSegment.quality === 'poor'
                              ? 'Poor condition. Recurring cracks and edge ravelling.'
                              : 'CRITICAL FAILURE: Recurring potholes post-patching.'}
                          </Text>
                        </View>

                        {/* PCI Linear Bar Indicator */}
                        <View style={styles.pciBarTrack}>
                          <View
                            style={[
                              styles.pciBarFill,
                              {
                                width: `${selectedSegment.pciScore}%`,
                                backgroundColor: selectedSegment.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}

                    {/* Chronic Recurrence Alert Card */}
                    {isRoadMemory(selectedSegment) && selectedSegment.isRecurringHotspot && (
                      <View style={styles.recurringAlertBox}>
                        <View style={styles.recurringAlertHeader}>
                          <Ionicons name="alert-circle" size={20} color="#DC2626" />
                          <Text style={styles.recurringAlertTitle}>
                            CHRONIC DAMAGE HOTSPOT ({selectedSegment.recurrenceCount}x Recurrence)
                          </Text>
                        </View>
                        <Text style={styles.recurringAlertDesc}>
                          This identical corridor repeatedly develops severe defects despite prior municipal repairs.
                        </Text>
                        <View style={styles.rootCauseBox}>
                          <Text style={styles.rootCauseLabel}>ENGINEERING ROOT CAUSE:</Text>
                          <Text style={styles.rootCauseText}>
                            {selectedSegment.damagePattern}
                          </Text>
                        </View>
                        <View style={styles.distinctionNote}>
                          <Ionicons name="information-circle-outline" size={14} color="#7F1D1D" />
                          <Text style={styles.distinctionNoteText}>
                            Road Memory tracks long-term structural failure, identifying chronic contractor failure vs isolated defects.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Defect Quick Metrics Grid */}
                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>POTHOLES</Text>
                        <Text style={styles.metricValue}>
                          {isRoadMemory(selectedSegment) ? selectedSegment.potholeCount : selectedSegment.hazardCount}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>SURFACE CRACKS</Text>
                        <Text style={styles.metricValue}>
                          {isRoadMemory(selectedSegment) ? selectedSegment.crackCount : 0}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>RE-REPAIRS</Text>
                        <Text style={[styles.metricValue, { color: AppColors.accent }]}>
                          {isRoadMemory(selectedSegment) ? `${selectedSegment.recurrenceCount}x` : '0x'}
                        </Text>
                      </View>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricLabel}>LAST WORK</Text>
                        <Text style={[styles.metricValue, { fontSize: 11 }]}>
                          {isRoadMemory(selectedSegment) ? selectedSegment.lastRepairedDate : 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Repair & Failure History Timeline */}
                    {isRoadMemory(selectedSegment) && selectedSegment.repairHistory && (
                      <View style={styles.timelineSection}>
                        <View style={styles.timelineSectionHeader}>
                          <Ionicons name="git-commit-outline" size={18} color={AppColors.primary} />
                          <Text style={styles.timelineSectionTitle}>
                            Repair & Deterioration History
                          </Text>
                        </View>
                        <Text style={styles.timelineSectionSub}>
                          Historical municipal repair attempts and subsequent pavement re-damage
                        </Text>

                        {selectedSegment.repairHistory.map((rep, rIdx) => (
                          <View key={rep.id} style={styles.timelineItem}>
                            {/* Vertical Line */}
                            {rIdx < selectedSegment.repairHistory.length - 1 && (
                              <View style={styles.timelineLine} />
                            )}

                            {/* Node Dot */}
                            <View
                              style={[
                                styles.timelineDot,
                                {
                                  backgroundColor:
                                    rep.status === 'failed'
                                      ? '#DC2626'
                                      : rep.status === 'deteriorated'
                                      ? '#D97706'
                                      : '#16A34A',
                                },
                              ]}
                            />

                            <View style={styles.timelineContent}>
                              <View style={styles.timelineContentHeader}>
                                <Text style={styles.timelineDate}>{rep.date}</Text>
                                <View
                                  style={[
                                    styles.repairStatusBadge,
                                    {
                                      backgroundColor:
                                        rep.status === 'failed'
                                          ? '#FEE2E2'
                                          : rep.status === 'deteriorated'
                                          ? '#FEF3C7'
                                          : '#DCFCE7',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.repairStatusText,
                                      {
                                        color:
                                          rep.status === 'failed'
                                            ? '#991B1B'
                                            : rep.status === 'deteriorated'
                                            ? '#92400E'
                                            : '#166534',
                                      },
                                    ]}
                                  >
                                    {rep.status === 'failed'
                                      ? `FAILED IN ${rep.daysUntilFailure} DAYS`
                                      : rep.status.toUpperCase()}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.repairType}>{rep.repairType}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 }}>
                                <Text style={styles.contractorName}>Contractor: {rep.contractor}</Text>
                                <Text style={styles.costEstimate}>· Cost: {rep.costEstimate}</Text>
                              </View>
                              <Text style={styles.repairNotes}>{rep.notes}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>

                  {/* Modal Footer */}
                  <View style={styles.modalFooter}>
                    <Button
                      title="View on Map"
                      variant="primary"
                      size="md"
                      icon="map-outline"
                      onPress={() => {
                        setIsMemoryModalVisible(false);
                        setViewMode('map');
                      }}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  container: { flex: 1, backgroundColor: AppColors.bg },
  headerBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.bg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: { color: AppColors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  prototypeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  prototypeBadgeText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '800',
  },
  pageSub: { color: AppColors.textSecondary, fontSize: 11, marginTop: 2 },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: AppColors.primary,
  },
  toggleBtnText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  toggleBtnTextActive: {
    color: AppColors.surface,
  },
  kpiContainer: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    justifyContent: 'space-around',
  },
  kpiTile: {
    alignItems: 'center',
    gap: 2,
  },
  kpiLabel: {
    color: AppColors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValue: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  pciPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pciDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kpiValueHighlight: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: AppColors.bg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  floatingInfoPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 70,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floatingInfoText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textPrimary,
    flex: 1,
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
  tableScreenContainer: {
    flex: 1,
    backgroundColor: AppColors.bg,
  },
  tableFilterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: 'row',
  },
  tableFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  tableFilterPillActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  tableFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  tableFilterTextActive: {
    color: AppColors.surface,
  },
  tableScrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  tableCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
    marginBottom: 40,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.borderLight || '#f0f0f0',
  },
  tableDataRowAlt: {
    backgroundColor: '#FAFAF8',
  },
  tableDataRowHotspot: {
    backgroundColor: '#FFF7ED',
  },
  tableDataCell: {
    fontSize: 12,
    color: AppColors.textPrimary,
  },
  tableRoadName: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  tableRoadType: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
  },
  tableRoadDist: {
    fontSize: 10,
    color: AppColors.textSecondary,
  },
  tablePciBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tablePciBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  tableRecurrenceBadgeWarn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableRecurrenceBadgeWarnText: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '800',
  },
  tableRecurrenceBadgeOk: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableRecurrenceBadgeOkText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '700',
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
  locatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.bg,
    padding: 24,
    gap: 8,
  },
  locatingPulseBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  locatingTitle: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  locatingSub: {
    color: AppColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  modalCategoryTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 0.5,
  },
  modalRoadTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginTop: 2,
  },
  modalRoadSub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pciGaugeBox: {
    backgroundColor: AppColors.cardAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 14,
  },
  pciGaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pciGaugeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 0.5,
  },
  pciGradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pciGradeBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  pciScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  pciScoreBig: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  pciScoreMax: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textMuted,
    marginRight: 6,
  },
  pciScoreDesc: {
    flex: 1,
    fontSize: 11,
    color: AppColors.textSecondary,
    lineHeight: 15,
  },
  pciBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  pciBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  recurringAlertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  recurringAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  recurringAlertTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  recurringAlertDesc: {
    color: '#7F1D1D',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  rootCauseBox: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 6,
  },
  rootCauseLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  rootCauseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 16,
  },
  distinctionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  distinctionNoteText: {
    fontSize: 10,
    color: '#7F1D1D',
    fontStyle: 'italic',
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: AppColors.cardAlt,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textMuted,
    marginBottom: 2,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  timelineSection: {
    marginBottom: 20,
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timelineSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  timelineSectionSub: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
    paddingBottom: 16,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 14,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginTop: 2,
    marginRight: 10,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: AppColors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  timelineContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  repairStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  repairStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  repairType: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  contractorName: {
    fontSize: 10,
    color: AppColors.textSecondary,
    fontWeight: '600',
  },
  costEstimate: {
    fontSize: 10,
    color: AppColors.textMuted,
  },
  repairNotes: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  defectsActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  defectsCountLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.textSecondary,
    letterSpacing: 0.5,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  deleteCardBtn: {
    padding: 5,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  emptyDefectsBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginTop: 20,
  },
  emptyDefectsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  emptyDefectsSub: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

