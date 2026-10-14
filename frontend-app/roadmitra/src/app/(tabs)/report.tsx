import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  HAZARD_TYPES_LIST,
  HAZARD_LABELS,
  HAZARD_VECTOR_ICONS,
  HazardType,
} from '../../constants/hazardTypes';
import { api } from '../../services/api';
import { storage } from '../../services/storage';
import { AppColors } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

type Step = 'form' | 'review';

export default function ReportScreen() {
  const [step, setStep] = useState<Step>('form');
  const [hazardType, setHazardType] = useState<HazardType>('pothole');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number; accuracy: number }>({
    lat: 18.9388,
    lon: 72.8354,
    accuracy: 8,
  });

  // Fetch real current GPS position
  useEffect(() => {
    async function getRealLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setCurrentCoords({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            accuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy) : 6,
          });
        }
      } catch (e) {
        console.warn('Could not fetch real GPS for report:', e);
      }
    }
    getRealLocation();
  }, []);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow camera access to photograph road hazards.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });

      if (!res.canceled && res.assets[0]?.uri) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not open camera.');
    }
  };

  const handlePickLibrary = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        allowsEditing: false,
      });

      if (!res.canceled && res.assets[0]?.uri) {
        setPhotoUri(res.assets[0].uri);
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const reportId = `rep-${Date.now()}`;
    const payload = {
      report_id: reportId,
      device_id: 'device-local',
      ts: new Date().toISOString(),
      lat: currentCoords.lat,
      lon: currentCoords.lon,
      gps_accuracy_m: currentCoords.accuracy,
      type: hazardType,
      notes: notes.trim() || undefined,
      photo_uri: photoUri ?? undefined,
    };

    try {
      const res = await api.postReport(payload);
      const acceptedCount = String(res.accepted ?? 1);
      const dupCount = String(res.duplicates ?? 0);
      const noticeMsg = (res.notices as any[])?.[0]?.message ?? '';

      setStep('form');
      setNotes('');
      setPhotoUri(null);

      router.push({
        pathname: '/report-result',
        params: {
          accepted: acceptedCount,
          duplicates: dupCount,
          type: HAZARD_LABELS[hazardType],
          notice: noticeMsg,
        },
      });
    } catch {
      // Offline fallback: save to upload queue
      await storage.addToQueue({
        id: `upload-report-${reportId}`,
        type: 'report',
        status: 'pending',
        attempts: 0,
        createdAt: Date.now(),
        payload,
      });

      setStep('form');
      setNotes('');
      setPhotoUri(null);

      router.push({
        pathname: '/report-result',
        params: {
          accepted: '1',
          duplicates: '0',
          type: HAZARD_LABELS[hazardType],
          notice: 'Queued locally — will upload automatically when online.',
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'review') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setStep('form')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Edit Report</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Review Report</Text>

          <Card variant="elevated">
            <Text style={styles.reviewLabel}>Hazard Type</Text>
            <View style={styles.reviewTypeRow}>
              <MaterialCommunityIcons
                name={HAZARD_VECTOR_ICONS[hazardType] || 'alert-circle'}
                size={22}
                color={AppColors.primary}
              />
              <Text style={styles.reviewValue}>{HAZARD_LABELS[hazardType]}</Text>
            </View>
          </Card>

          <Card variant="elevated">
            <Text style={styles.reviewLabel}>GPS Coordinates</Text>
            <Text style={styles.reviewValue}>
              {currentCoords.lat.toFixed(5)}, {currentCoords.lon.toFixed(5)}
            </Text>
            <Text style={styles.reviewMeta}>Accuracy: ±{currentCoords.accuracy} m</Text>
          </Card>

          {notes ? (
            <Card variant="elevated">
              <Text style={styles.reviewLabel}>Notes</Text>
              <Text style={styles.reviewValue}>{notes}</Text>
            </Card>
          ) : null}

          {photoUri ? (
            <Card variant="elevated">
              <Text style={styles.reviewLabel}>Attached Evidence</Text>
              <Image source={{ uri: photoUri }} style={styles.reviewPhotoPreview} />
              <View style={styles.privacyNote}>
                <Ionicons name="lock-closed-outline" size={14} color={AppColors.textSecondary} />
                <Text style={styles.reviewMeta}>
                  Photos are stripped of metadata and faces/license plates blurred before ingestion.
                </Text>
              </View>
            </Card>
          ) : null}

          <Button
            title="Submit Road Hazard Report"
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            icon="checkmark-circle"
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Report Road Defect</Text>
        <Text style={styles.pageSubtitle}>Submit road hazard observations to corroborate vehicle telemetry</Text>

        <Text style={styles.fieldLabel}>Select Hazard Type</Text>
        <View style={styles.typeGrid}>
          {HAZARD_TYPES_LIST.filter((t) => t !== 'speed_breaker').map((t) => {
            const isSelected = hazardType === t;
            const iconName = HAZARD_VECTOR_ICONS[t] || 'alert-circle';
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
                onPress={() => setHazardType(t)}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, isSelected && styles.typeIconBoxActive]}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={22}
                    color={isSelected ? AppColors.surface : AppColors.primary}
                  />
                </View>
                <Text style={[styles.typeLabel, isSelected && styles.typeLabelActive]}>
                  {HAZARD_LABELS[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Current GPS Location</Text>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={18} color={AppColors.primary} />
            <Text style={styles.locationCoords}>
              {currentCoords.lat.toFixed(5)}, {currentCoords.lon.toFixed(5)}
            </Text>
          </View>
          <Text style={styles.locationMeta}>Fix Accuracy: ±{currentCoords.accuracy} m</Text>
        </View>

        <Text style={styles.fieldLabel}>Evidence Photo (Optional)</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => setPhotoUri(null)}
            >
              <Ionicons name="close" size={16} color={AppColors.surface} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActionsRow}>
            <TouchableOpacity style={styles.photoActionBtn} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={20} color={AppColors.primary} />
              <Text style={styles.photoActionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickLibrary}>
              <Ionicons name="images-outline" size={20} color={AppColors.primary} />
              <Text style={styles.photoActionText}>Choose from Library</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.fieldLabel}>Field Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="e.g. Sharp edges, deep pothole in right lane, water filled"
          placeholderTextColor={AppColors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          maxLength={250}
        />

        <Button
          title="Review & Confirm Report"
          variant="primary"
          size="lg"
          fullWidth
          icon="arrow-forward"
          iconPosition="right"
          onPress={() => setStep('review')}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.bg },
  content: { padding: 18, gap: 12, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backBtnText: { color: AppColors.primary, fontSize: 14, fontWeight: '700' },
  pageTitle: { color: AppColors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { color: AppColors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: -4 },
  fieldLabel: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: {
    width: '48%',
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    shadowColor: AppColors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  typeBtnActive: { borderColor: AppColors.primary, backgroundColor: AppColors.cardAlt },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppColors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxActive: { backgroundColor: AppColors.primary },
  typeLabel: { color: AppColors.textSecondary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  typeLabelActive: { color: AppColors.primary, fontWeight: '800' },
  locationCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationCoords: { color: AppColors.textPrimary, fontSize: 15, fontWeight: '700' },
  locationMeta: { color: AppColors.textSecondary, fontSize: 12, fontWeight: '500' },
  photoActionsRow: { flexDirection: 'row', gap: 10 },
  photoActionBtn: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  photoActionText: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
  photoContainer: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 160, borderRadius: 16 },
  removePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 14,
    color: AppColors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  reviewLabel: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  reviewTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewValue: { color: AppColors.textPrimary, fontSize: 15, fontWeight: '700' },
  reviewMeta: { color: AppColors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  reviewPhotoPreview: { width: '100%', height: 160, borderRadius: 12, marginTop: 8 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
});
