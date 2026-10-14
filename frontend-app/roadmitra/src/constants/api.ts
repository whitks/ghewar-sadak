export const API_BASE_URL = 'https://ghewar-sadak.onrender.com';
export const API_KEY = 'demo-key';

export const ENDPOINTS = {
  events: '/api/v1/events',
  track: '/api/v1/track',
  reports: '/api/v1/reports',
  hazardsNearby: '/api/v1/hazards/nearby',
  hazardDetail: (id: string) => `/api/v1/hazards/${id}`,
  cameraDetections: '/api/v1/camera/detections',
  cameraTrack: '/api/v1/camera/track',
};
