import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native';
import { Camera, FolderOpen, MapPin, Navigation } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { dark, typography, radii } from '../constants/theme';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/Badge';
import type { PotholeReport } from '../types';

export function DashboardScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [addressNotes, setAddressNotes] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const bumpReportsVersion = useStore((s) => s.bumpReportsVersion);

  useEffect(() => {
    fetchReports();
    getCurrentLocation(false);
  }, []);

  const fetchReports = async () => {
    try {
      const data = await api('/reports');
      setReports(data.reports || []);
    } catch (err) {
      console.warn('Failed to fetch reports', err);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera/photo library access is required');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const setReportLocation = (coords: { lat: number; lng: number }) => {
    setLocation(coords);
    mapRef.current?.animateToRegion({
      latitude: coords.lat,
      longitude: coords.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  const getCurrentLocation = async (showError = true) => {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationPermissionGranted(false);
        if (showError) {
          Alert.alert('Location needed', 'Please allow location access or tap the map to choose the pothole location');
        }
        return null;
      }

      setLocationPermissionGranted(true);
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };
      setReportLocation(coords);
      return coords;
    } catch (err) {
      console.warn('Failed to get current location', err);
      if (showError) {
        Alert.alert('Location error', 'Could not get your current location. Please try again or tap the map to choose manually');
      }
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  const submitReport = async () => {
    if (!selectedImage) {
      Alert.alert('Photo needed', 'Please add a pothole photo first');
      return;
    }
    const reportLocation = location || await getCurrentLocation(true);
    if (!reportLocation) {
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedImage.uri,
        type: selectedImage.mimeType || 'image/jpeg',
        name: selectedImage.fileName || `photo.${selectedImage.mimeType?.split('/')[1] || 'jpg'}`,
      } as any);
      const upload = await api('/uploads/local', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      const created = await api('/reports', {
        method: 'POST',
        body: {
          s3_key: upload.key,
          latitude: reportLocation.lat,
          longitude: reportLocation.lng,
          notes: addressNotes || undefined,
        },
      });
      const optimisticReport: PotholeReport = {
        id: created.report_id || `local-${Date.now()}`,
        image_s3_key: upload.key,
        latitude: reportLocation.lat,
        longitude: reportLocation.lng,
        address_notes: addressNotes || undefined,
        status: created.status || 'pending',
        created_at: new Date().toISOString(),
      };
      setReports((current) => [optimisticReport, ...current]);
      bumpReportsVersion();
      setSelectedImage(null);
      setAddressNotes('');
      setLocation(null);
      void fetchReports();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          Report a <Text style={styles.heroHighlight}>Pothole</Text>
        </Text>
        <Text style={styles.heroSubtitle}>Help keep roads safe for everyone</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Location</Text>
          <TouchableOpacity
            style={[styles.locationBtn, locationLoading && styles.disabled]}
            onPress={() => getCurrentLocation(true)}
            disabled={locationLoading}
            activeOpacity={0.7}
          >
            <Navigation size={14} color={dark.textPrimary} />
            <Text style={styles.locationBtnText}>
              {locationLoading ? 'Locating...' : 'Current'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{ latitude: 20, longitude: 78, latitudeDelta: 20, longitudeDelta: 20 }}
            showsUserLocation={locationPermissionGranted}
            onPress={(e) => setReportLocation({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          >
            {location && (
              <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
                <View style={styles.markerDot} />
              </Marker>
            )}
          </MapView>
          {location && (
            <View style={styles.coords}>
              <Navigation size={14} color={dark.textSecondary} />
              <Text style={styles.coordText}>
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </Text>
            </View>
          )}
          {!location && (
            <View style={styles.coords}>
              <Navigation size={14} color={dark.textSecondary} />
              <Text style={styles.coordText}>
                {locationLoading ? 'Getting current location...' : 'Allow location access or tap the map'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Photo</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(true)} activeOpacity={0.7}>
            <Camera size={28} color={dark.textSecondary} />
            <Text style={styles.uploadText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(false)} activeOpacity={0.7}>
            <FolderOpen size={28} color={dark.textSecondary} />
            <Text style={styles.uploadText}>Browse</Text>
          </TouchableOpacity>
        </View>
        {selectedImage && (
          <Image source={{ uri: selectedImage.uri }} style={styles.preview} />
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.disabled]}
        onPress={submitReport}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.submitBtnText}>{loading ? 'Submitting...' : 'Submit Report'}</Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Reports</Text>
        {reports.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MapPin size={32} color={dark.textSecondary} />
            <Text style={styles.emptyText}>No reports yet</Text>
          </Card>
        ) : (
          <View style={styles.reportGrid}>
            {reports.map((r) => (
              <Card key={r.id} style={styles.reportCard}>
                <StatusBadge status={r.status} />
                <Text style={styles.reportLocation}>
                  {Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}
                </Text>
                {r.block_id && (
                  <Text style={styles.mono}>Block: {r.block_id}</Text>
                )}
                <Text style={styles.reportDate}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  content: { paddingBottom: 40 },
  hero: {
    padding: 40, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: dark.border,
  },
  heroTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes['4xl'],
    color: dark.heading,
  },
  heroHighlight: { color: dark.textPrimary },
  heroSubtitle: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.base,
    color: dark.textSecondary,
    marginTop: 8,
  },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: typography.sizes.xl,
    color: dark.heading,
    marginBottom: 12,
  },
  sectionTitleInline: { marginBottom: 0 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: dark.mutedSurface,
    borderWidth: 1,
    borderColor: dark.border,
  },
  locationBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
  mapContainer: {
    height: 250, borderRadius: radii.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: dark.border,
  },
  map: { flex: 1 },
  markerDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: dark.mapMarkerBlue,
    borderWidth: 3, borderColor: '#fff',
    shadowColor: dark.mapMarkerBlue, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  coords: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, backgroundColor: dark.mutedSurface,
  },
  coordText: {
    fontFamily: typography.monoFamily,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  uploadRow: { flexDirection: 'row', gap: 12 },
  uploadBtn: {
    flex: 1, height: 100, borderRadius: radii.xl,
    borderWidth: 2, borderColor: dark.border, borderStyle: 'dashed',
    backgroundColor: dark.surface,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textSecondary,
  },
  preview: {
    width: '100%', height: 200, borderRadius: radii.lg, marginTop: 12,
    borderWidth: 1, borderColor: dark.border,
  },
  submitBtn: {
    marginHorizontal: 16, height: 48, borderRadius: radii.xl,
    backgroundColor: dark.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.base, color: '#fff',
  },
  disabled: { opacity: 0.6 },
  emptyCard: {
    padding: 40, alignItems: 'center', gap: 12,
    borderStyle: 'dashed', borderWidth: 2,
  },
  emptyText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.base,
    color: dark.textSecondary,
  },
  reportGrid: { gap: 12 },
  reportCard: { gap: 8 },
  reportLocation: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: typography.sizes.sm,
    color: dark.textPrimary,
  },
  mono: {
    fontFamily: typography.monoFamily,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
  reportDate: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: typography.sizes.xs,
    color: dark.textSecondary,
  },
});
