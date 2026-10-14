import { HazardType, HazardStatus, HazardSource } from '../constants/hazardTypes';

export interface Hazard {
  id: string;
  lat: number;
  lon: number;
  type: HazardType;
  status: HazardStatus;
  confidence: number;
  severity: number;
  source: HazardSource;
  cameraScore?: number;
  phoneScore?: number;
  deviceCount: number;
  lastSeen: string;
  isSimulated?: boolean;
  description?: string;
  photoUri?: string;
  magnitude?: number;
  speedKmh?: number;
}

export interface Trip {
  id: string;
  startTime: string | number;
  endTime?: string | number;
  duration?: number;
  distanceKm: number;
  distance?: number;
  eventCount: number;
  events?: number;
  reportCount: number;
  uploadStatus: 'pending' | 'uploading' | 'done' | 'failed';
  status?: string;
  points?: Array<{ lat: number; lon: number; ts: number; speed: number }>;
  route?: Array<{ lat: number; lon: number; timestamp: number }>;
  isSimulated?: boolean;
}

export interface UploadQueueItem {
  id: string;
  type: 'event' | 'track' | 'report';
  status: 'pending' | 'uploading' | 'done' | 'failed';
  createdAt: number | string;
  attempts?: number;
  retries?: number;
  payload?: Record<string, any>;
  data?: any;
}

// Default seed coordinates for road defects (Mumbai central corridor)
const MUMBAI = { lat: 18.9388, lon: 72.8354 };
const offset = (d: number) => d * 0.001;

export const MOCK_HAZARDS: Hazard[] = [
  {
    id: 'haz-001',
    lat: MUMBAI.lat + offset(1.2),
    lon: MUMBAI.lon + offset(0.8),
    type: 'pothole',
    status: 'confirmed',
    confidence: 0.87,
    severity: 72,
    source: 'both',
    cameraScore: 0.82,
    phoneScore: 0.79,
    deviceCount: 4,
    lastSeen: new Date(Date.now() - 2 * 3600000).toISOString(),
    description: 'Vision detection corroborated by 4 phone accelerometer jolts.',
  },
  {
    id: 'haz-002',
    lat: MUMBAI.lat - offset(0.5),
    lon: MUMBAI.lon + offset(1.5),
    type: 'alligator_crack',
    status: 'probable',
    confidence: 0.61,
    severity: 48,
    source: 'camera',
    cameraScore: 0.73,
    phoneScore: undefined,
    deviceCount: 1,
    lastSeen: new Date(Date.now() - 6 * 3600000).toISOString(),
    description: 'Vision AI detected road fatigue cracks on outer lane.',
  },
  {
    id: 'haz-003',
    lat: MUMBAI.lat + offset(0.3),
    lon: MUMBAI.lon - offset(1.1),
    type: 'rough_patch',
    status: 'probable',
    confidence: 0.58,
    severity: 40,
    source: 'phone',
    cameraScore: undefined,
    phoneScore: 0.65,
    deviceCount: 3,
    lastSeen: new Date(Date.now() - 4 * 3600000).toISOString(),
    description: '3 vehicles recorded consistent sustained vertical vibration.',
  },
  {
    id: 'haz-004',
    lat: MUMBAI.lat - offset(1.0),
    lon: MUMBAI.lon - offset(0.6),
    type: 'speed_breaker',
    status: 'confirmed',
    confidence: 0.79,
    severity: 30,
    source: 'phone',
    phoneScore: 0.81,
    deviceCount: 5,
    lastSeen: new Date(Date.now() - 1 * 3600000).toISOString(),
    description: 'Speed reduction before vertical displacement detected across 5 vehicles.',
  },
  {
    id: 'haz-005',
    lat: MUMBAI.lat + offset(1.8),
    lon: MUMBAI.lon + offset(2.0),
    type: 'pothole',
    status: 'conflicting',
    confidence: 0.58,
    severity: 55,
    source: 'both',
    cameraScore: 0.75,
    phoneScore: 0.12,
    deviceCount: 6,
    lastSeen: new Date(Date.now() - 3 * 3600000).toISOString(),
    description: 'Visual alert logged; phone accelerometer records indicate smooth traversal.',
  },
  {
    id: 'haz-006',
    lat: MUMBAI.lat - offset(1.5),
    lon: MUMBAI.lon + offset(0.3),
    type: 'pothole',
    status: 'unconfirmed',
    confidence: 0.32,
    severity: 25,
    source: 'phone',
    phoneScore: 0.35,
    deviceCount: 1,
    lastSeen: new Date(Date.now() - 12 * 3600000).toISOString(),
    description: 'Single shock report recorded. Awaiting multi-vehicle corroboration.',
  },
];

export const MOCK_TRIPS: Trip[] = [
  {
    id: 'trip-001',
    startTime: new Date(Date.now() - 25 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 24 * 3600000).toISOString(),
    duration: 3600,
    distanceKm: 2.4,
    eventCount: 8,
    reportCount: 1,
    uploadStatus: 'done',
    points: [],
    route: [
      { lat: MUMBAI.lat - 0.0018, lon: MUMBAI.lon + 0.0003, timestamp: Date.now() - 3600000 },
      { lat: MUMBAI.lat - 0.0015, lon: MUMBAI.lon + 0.0003, timestamp: Date.now() - 3500000 },
      { lat: MUMBAI.lat - 0.0010, lon: MUMBAI.lon - 0.0004, timestamp: Date.now() - 3400000 },
      { lat: MUMBAI.lat - 0.0005, lon: MUMBAI.lon + 0.0012, timestamp: Date.now() - 3300000 },
      { lat: MUMBAI.lat - 0.0001, lon: MUMBAI.lon + 0.0014, timestamp: Date.now() - 3200000 },
      { lat: MUMBAI.lat + 0.0003, lon: MUMBAI.lon - 0.0008, timestamp: Date.now() - 3100000 },
      { lat: MUMBAI.lat + 0.0007, lon: MUMBAI.lon + 0.0001, timestamp: Date.now() - 3000000 },
      { lat: MUMBAI.lat + 0.0011, lon: MUMBAI.lon + 0.0006, timestamp: Date.now() - 2900000 },
      { lat: MUMBAI.lat + 0.0014, lon: MUMBAI.lon + 0.0010, timestamp: Date.now() - 2800000 },
      { lat: MUMBAI.lat + 0.0017, lon: MUMBAI.lon + 0.0016, timestamp: Date.now() - 2700000 },
      { lat: MUMBAI.lat + 0.0020, lon: MUMBAI.lon + 0.0021, timestamp: Date.now() - 2600000 },
    ],
  },
  {
    id: 'trip-002',
    startTime: new Date(Date.now() - 49 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 48 * 3600000).toISOString(),
    duration: 2400,
    distanceKm: 7.8,
    eventCount: 3,
    reportCount: 0,
    uploadStatus: 'done',
    points: [],
  },
  {
    id: 'trip-003',
    startTime: new Date(Date.now() - 73 * 3600000).toISOString(),
    endTime: new Date(Date.now() - 72 * 3600000).toISOString(),
    duration: 1800,
    distanceKm: 5.2,
    eventCount: 5,
    reportCount: 2,
    uploadStatus: 'failed',
    points: [],
  },
];
