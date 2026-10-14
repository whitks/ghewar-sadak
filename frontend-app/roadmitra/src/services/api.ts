/**
 * RoadMitra Backend API Client for React Native / Expo.
 *
 * Connects the mobile app to the Python backend:
 * - Sends dashcam frames every 10 seconds with GPS telemetry
 * - Polls for nearby potholes for real-time driver proximity alerts
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
}

// Set your backend IP (use your LAN IP e.g. http://192.168.x.x:8000 when running on a physical phone)
export const BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * Upload a captured dashcam frame with GPS coordinates to the backend.
 * Typically invoked every 10 seconds via an interval timer.
 */
export async function uploadDashcamFrame(
  imageUri: string,
  gps: GpsCoordinates,
  deviceId: string = 'mobile_dashcam_01'
): Promise<UploadFrameResponse> {
  const formData = new FormData();

  // Attach image
  const filename = imageUri.split('/').pop() || 'dashcam_frame.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  // @ts-ignore: React Native FormData format
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: type,
  });

  formData.append('latitude', gps.latitude.toString());
  formData.append('longitude', gps.longitude.toString());
  formData.append('altitude', (gps.altitude || 0).toString());
  formData.append('speed_kmh', (gps.speed || 0).toString());
  formData.append('device_id', deviceId);
  formData.append('timestamp', new Date().toISOString());

  const response = await fetch(`${BACKEND_URL}/api/upload-frame`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
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
  const url = `${BACKEND_URL}/api/potholes/nearby?lat=${latitude}&lon=${longitude}&radius_km=${radiusKm}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nearby query failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.potholes || [];
}

/**
 * Get overall pothole statistics and counts.
 */
export async function getPotholeStats() {
  const response = await fetch(`${BACKEND_URL}/api/stats`);
  return await response.json();
}
