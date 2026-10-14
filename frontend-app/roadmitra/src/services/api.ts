import { API_BASE_URL, API_KEY, ENDPOINTS } from '@/constants/api';
import { Hazard, MOCK_HAZARDS } from './mockData';
import { HazardType } from '@/constants/hazardTypes';

/**
 * RoadMitra Backend API Client for React Native / Expo.
 *
 * Connects the mobile app to the backend:
 * - Dashcam frame ingestion every 10s with GPS telemetry & AI pothole detection
 * - Real-time proximity searches for driver hazard alerts
 * - Road defect statistics & GIS mapping
 * - Telemetry event streaming, trip tracking, and user hazard reporting
 */

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // km/h
}

export interface PotholeDetection {
  id: number;
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
  estimated_depth_cm: number;
  depth_class: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  repair_urgency: string;
  distance_meters?: number;
}

export interface UploadFrameResponse {
  status: string;
  frame_id: string;
  timestamp: string;
  potholes_found: number;
  detections: PotholeDetection[];
  annotated_image_url: string;
  raw_image_url: string;
  gps?: {
    latitude: number;
    longitude: number;
    altitude: number;
    speed_kmh: number;
  };
  device_id?: string;
}

// Set your backend IP (defaults to API_BASE_URL or local development host)
export const BACKEND_URL = API_BASE_URL || 'http://127.0.0.1:8000';

function buildUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
    const reqHeaders: Record<string, string> = {
      'X-API-Key': API_KEY,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...((options?.headers as Record<string, string>) || {}),
    };
    if (isFormData) {
      delete reqHeaders['Content-Type'];
    }

    const url = buildUrl(BACKEND_URL, path);
    const res = await fetch(url, {
      ...options,
      headers: reqHeaders,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload a captured dashcam frame with GPS coordinates to the backend.
 * Typically invoked every 10 seconds via an interval timer.
 * Note: Multipart uploads do NOT send 'Content-Type: application/json' so the runtime boundary is preserved.
 */
export async function uploadDashcamFrame(
  imageUri: string,
  gps: GpsCoordinates,
  deviceId: string = 'mobile_dashcam_01'
): Promise<UploadFrameResponse> {
  const formData = new FormData();

  // Extract clean filename and mime type (stripping query parameters and fragments)
  const cleanUri = imageUri.split('?')[0].split('#')[0];
  const filename = cleanUri.split('/').pop() || 'dashcam_frame.jpg';
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpeg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // @ts-ignore: React Native FormData format
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  });

  formData.append('latitude', gps.latitude.toString());
  formData.append('longitude', gps.longitude.toString());
  formData.append('altitude', (gps.altitude ?? 0).toString());
  formData.append('speed_kmh', (gps.speed ?? 0).toString());
  formData.append('device_id', deviceId);
  formData.append('timestamp', new Date().toISOString());

  const uploadUrl = buildUrl(BACKEND_URL, '/api/upload-frame');
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
      // Explicitly no Content-Type header so the runtime sets multipart/form-data with proper boundary
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Fetch potholes within a radius (km) of current position for driver warning alerts.
 */
export async function getNearbyPotholes(
  latitude: number,
  longitude: number,
  radiusKm: number = 0.5
): Promise<PotholeDetection[]> {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    radius_km: radiusKm.toString(),
  });
  const url = buildUrl(BACKEND_URL, `/api/potholes/nearby?${params.toString()}`);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Nearby query failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.potholes || [];
}

/**
 * Get overall pothole statistics and counts.
 */
export async function getPotholeStats(): Promise<any> {
  const url = buildUrl(BACKEND_URL, '/api/stats');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Stats query failed: ${response.statusText}`);
  }
  return await response.json();
}

export const api = {
  async getNearbyHazards(
    lat: number,
    lon: number,
    radiusM = 500,
    minConfidence = 0.3,
  ): Promise<Hazard[]> {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        radius_m: radiusM.toString(),
        min_confidence: minConfidence.toString(),
      });
      return await apiFetch<Hazard[]>(`${ENDPOINTS.hazardsNearby}?${params.toString()}`);
    } catch {
      // Fall back to mock data
      return MOCK_HAZARDS;
    }
  },

  async getHazardDetail(id: string): Promise<Hazard | null> {
    try {
      return await apiFetch<Hazard>(ENDPOINTS.hazardDetail(id));
    } catch {
      return MOCK_HAZARDS.find((h) => h.id === id) ?? null;
    }
  },

  async postEvents(events: object[]): Promise<{ accepted: number; duplicates: number; notices: object[] }> {
    try {
      return await apiFetch(ENDPOINTS.events, {
        method: 'POST',
        body: JSON.stringify(events),
      });
    } catch {
      return { accepted: events.length, duplicates: 0, notices: [] };
    }
  },

  async postTrack(track: object): Promise<{ accepted: number; duplicates: number; notices: object[] }> {
    try {
      return await apiFetch(ENDPOINTS.track, {
        method: 'POST',
        body: JSON.stringify(track),
      });
    } catch {
      return { accepted: 1, duplicates: 0, notices: [] };
    }
  },

  async postReport(report: {
    report_id: string;
    device_id: string;
    ts: string;
    lat: number;
    lon: number;
    gps_accuracy_m: number;
    type: HazardType;
    notes?: string;
    photo_uri?: string;
  }): Promise<{ accepted: number; duplicates: number; notices: object[] }> {
    try {
      return await apiFetch(ENDPOINTS.reports, {
        method: 'POST',
        body: JSON.stringify(report),
      });
    } catch {
      return { accepted: 1, duplicates: 0, notices: [] };
    }
  },

  // Dashcam and pothole telemetry integrations
  uploadDashcamFrame,
  getNearbyPotholes,
  getPotholeStats,
};
