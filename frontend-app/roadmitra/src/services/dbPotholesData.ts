// Auto-generated from C:\Users\krish\Desktop\programming\ghewar-sadak\potholes.db
import { Hazard } from './mockData';
import { RoadMemorySegment } from './roadMemoryService';

export const DB_POTHOLES_COUNT = 22;
export const DB_ROAD_PCI = 15;
export const DB_CENTER_COORDS = {
  latitude: 28.61393527272728,
  longitude: 77.20902650000002
};

export const DB_POTHOLES_HAZARDS: Hazard[] = [
  {
    "id": "db-pothole-1",
    "lat": 28.613909,
    "lon": 77.209007,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2805,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.2805,
    "phoneScore": 0.54,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:35:31",
    "description": "Pothole from video footage (~8.2cm depth, High Severity) - Video footage frame 210/1911 (7.0s)",
    "magnitude": 1.88,
    "speedKmh": 35.0,
    "estimatedDepthCm": 8.2
  },
  {
    "id": "db-pothole-2",
    "lat": 28.61391,
    "lon": 77.209008,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2795,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.2795,
    "phoneScore": 0.54,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:35:46",
    "description": "Pothole from video footage (~844.2cm depth, High Severity) - Video footage frame 240/1911 (8.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 844.2
  },
  {
    "id": "db-pothole-3",
    "lat": 28.613911,
    "lon": 77.209008,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.5496,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.5496,
    "phoneScore": 0.67,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:00",
    "description": "Pothole from video footage (~167.6cm depth, High Severity) - Video footage frame 270/1911 (9.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 167.6
  },
  {
    "id": "db-pothole-4",
    "lat": 28.613913,
    "lon": 77.209009,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.4025,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.4025,
    "phoneScore": 0.6,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:13",
    "description": "Pothole from video footage (~10.1cm depth, High Severity) - Video footage frame 300/1911 (10.0s)",
    "magnitude": 2.11,
    "speedKmh": 35.0,
    "estimatedDepthCm": 10.1
  },
  {
    "id": "db-pothole-5",
    "lat": 28.613914,
    "lon": 77.20901,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3746,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3746,
    "phoneScore": 0.59,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:29",
    "description": "Pothole from video footage (~24.3cm depth, High Severity) - Video footage frame 330/1911 (11.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 24.3
  },
  {
    "id": "db-pothole-6",
    "lat": 28.613914,
    "lon": 77.20901,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2187,
    "severity": 35,
    "source": "camera",
    "cameraScore": 0.2187,
    "phoneScore": 0.51,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:29",
    "description": "Pothole from video footage (~0.0cm depth, Low Severity) - Video footage frame 330/1911 (11.0s)",
    "magnitude": 1.1,
    "speedKmh": 35.0,
    "estimatedDepthCm": 0.0
  },
  {
    "id": "db-pothole-7",
    "lat": 28.613915,
    "lon": 77.209011,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3898,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3898,
    "phoneScore": 0.59,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:52",
    "description": "Pothole from video footage (~23.9cm depth, High Severity) - Video footage frame 360/1911 (12.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 23.9
  },
  {
    "id": "db-pothole-8",
    "lat": 28.613915,
    "lon": 77.209011,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3771,
    "severity": 60,
    "source": "camera",
    "cameraScore": 0.3771,
    "phoneScore": 0.59,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:36:52",
    "description": "Pothole from video footage (~4.6cm depth, Moderate Severity) - Video footage frame 360/1911 (12.0s)",
    "magnitude": 1.45,
    "speedKmh": 35.0,
    "estimatedDepthCm": 4.6
  },
  {
    "id": "db-pothole-9",
    "lat": 28.613941,
    "lon": 77.209031,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3204,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3204,
    "phoneScore": 0.56,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:41:50",
    "description": "Pothole from video footage (~16.3cm depth, High Severity) - Video footage frame 990/1911 (33.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 16.3
  },
  {
    "id": "db-pothole-10",
    "lat": 28.613943,
    "lon": 77.209032,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3103,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3103,
    "phoneScore": 0.56,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:42:11",
    "description": "Pothole from video footage (~20.8cm depth, High Severity) - Video footage frame 1020/1911 (34.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 20.8
  },
  {
    "id": "db-pothole-11",
    "lat": 28.613943,
    "lon": 77.209032,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2542,
    "severity": 60,
    "source": "camera",
    "cameraScore": 0.2542,
    "phoneScore": 0.53,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:42:11",
    "description": "Pothole from video footage (~3.0cm depth, Moderate Severity) - Video footage frame 1020/1911 (34.0s)",
    "magnitude": 1.26,
    "speedKmh": 35.0,
    "estimatedDepthCm": 3.0
  },
  {
    "id": "db-pothole-12",
    "lat": 28.613944,
    "lon": 77.209033,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3435,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3435,
    "phoneScore": 0.57,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:42:33",
    "description": "Pothole from video footage (~15.5cm depth, High Severity) - Video footage frame 1050/1911 (35.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 15.5
  },
  {
    "id": "db-pothole-13",
    "lat": 28.613944,
    "lon": 77.209033,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3029,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.3029,
    "phoneScore": 0.55,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:42:33",
    "description": "Pothole from video footage (~15.3cm depth, High Severity) - Video footage frame 1050/1911 (35.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 15.3
  },
  {
    "id": "db-pothole-14",
    "lat": 28.613945,
    "lon": 77.209034,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2355,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.2355,
    "phoneScore": 0.52,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:43:06",
    "description": "Pothole from video footage (~7.5cm depth, High Severity) - Video footage frame 1080/1911 (36.0s)",
    "magnitude": 1.8,
    "speedKmh": 35.0,
    "estimatedDepthCm": 7.5
  },
  {
    "id": "db-pothole-15",
    "lat": 28.613945,
    "lon": 77.209034,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2014,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.2014,
    "phoneScore": 0.5,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:43:06",
    "description": "Pothole from video footage (~11.3cm depth, High Severity) - Video footage frame 1080/1911 (36.0s)",
    "magnitude": 2.26,
    "speedKmh": 35.0,
    "estimatedDepthCm": 11.3
  },
  {
    "id": "db-pothole-16",
    "lat": 28.613946,
    "lon": 77.209035,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2604,
    "severity": 35,
    "source": "camera",
    "cameraScore": 0.2604,
    "phoneScore": 0.53,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:43:26",
    "description": "Pothole from video footage (~0.0cm depth, Low Severity) - Video footage frame 1110/1911 (37.0s)",
    "magnitude": 1.1,
    "speedKmh": 35.0,
    "estimatedDepthCm": 0.0
  },
  {
    "id": "db-pothole-17",
    "lat": 28.613946,
    "lon": 77.209035,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2268,
    "severity": 60,
    "source": "camera",
    "cameraScore": 0.2268,
    "phoneScore": 0.51,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:43:26",
    "description": "Pothole from video footage (~2.7cm depth, Moderate Severity) - Video footage frame 1110/1911 (37.0s)",
    "magnitude": 1.22,
    "speedKmh": 35.0,
    "estimatedDepthCm": 2.7
  },
  {
    "id": "db-pothole-18",
    "lat": 28.613948,
    "lon": 77.209036,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.3074,
    "severity": 35,
    "source": "camera",
    "cameraScore": 0.3074,
    "phoneScore": 0.55,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:43:49",
    "description": "Pothole from video footage (~0.0cm depth, Low Severity) - Video footage frame 1140/1911 (38.0s)",
    "magnitude": 1.1,
    "speedKmh": 35.0,
    "estimatedDepthCm": 0.0
  },
  {
    "id": "db-pothole-19",
    "lat": 28.613951,
    "lon": 77.209039,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.2362,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.2362,
    "phoneScore": 0.52,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:45:11",
    "description": "Pothole from video footage (~372.6cm depth, High Severity) - Video footage frame 1230/1911 (41.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 372.6
  },
  {
    "id": "db-pothole-20",
    "lat": 28.613951,
    "lon": 77.209039,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.224,
    "severity": 35,
    "source": "camera",
    "cameraScore": 0.224,
    "phoneScore": 0.51,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:45:11",
    "description": "Pothole from video footage (~0.0cm depth, Low Severity) - Video footage frame 1230/1911 (41.0s)",
    "magnitude": 1.1,
    "speedKmh": 35.0,
    "estimatedDepthCm": 0.0
  },
  {
    "id": "db-pothole-21",
    "lat": 28.613955,
    "lon": 77.209041,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.232,
    "severity": 85,
    "source": "camera",
    "cameraScore": 0.232,
    "phoneScore": 0.52,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:46:25",
    "description": "Pothole from video footage (~13.8cm depth, High Severity) - Video footage frame 1320/1911 (44.0s)",
    "magnitude": 2.5,
    "speedKmh": 35.0,
    "estimatedDepthCm": 13.8
  },
  {
    "id": "db-pothole-22",
    "lat": 28.613973,
    "lon": 77.209055,
    "type": "pothole",
    "status": "confirmed",
    "confidence": 0.4056,
    "severity": 35,
    "source": "camera",
    "cameraScore": 0.4056,
    "phoneScore": 0.6,
    "deviceCount": 1,
    "lastSeen": "2026-10-15 09:51:03",
    "description": "Pothole from video footage (~0.8cm depth, Low Severity) - Video footage frame 1740/1911 (58.0s)",
    "magnitude": 1.1,
    "speedKmh": 35.0,
    "estimatedDepthCm": 0.8
  }
];

export const DB_ROAD_SEGMENT: RoadMemorySegment = {
  "id": "seg-potholes-db-route",
  "roadName": "Surveyed Road Corridor (1.mp4 Pothole Route)",
  "roadType": "primary",
  "coordinates": [
    [
      28.613909,
      77.209007
    ],
    [
      28.61391,
      77.209008
    ],
    [
      28.613911,
      77.209008
    ],
    [
      28.613913,
      77.209009
    ],
    [
      28.613914,
      77.20901
    ],
    [
      28.613914,
      77.20901
    ],
    [
      28.613915,
      77.209011
    ],
    [
      28.613915,
      77.209011
    ],
    [
      28.613941,
      77.209031
    ],
    [
      28.613943,
      77.209032
    ],
    [
      28.613943,
      77.209032
    ],
    [
      28.613944,
      77.209033
    ],
    [
      28.613944,
      77.209033
    ],
    [
      28.613945,
      77.209034
    ],
    [
      28.613945,
      77.209034
    ],
    [
      28.613946,
      77.209035
    ],
    [
      28.613946,
      77.209035
    ],
    [
      28.613948,
      77.209036
    ],
    [
      28.613951,
      77.209039
    ],
    [
      28.613951,
      77.209039
    ],
    [
      28.613955,
      77.209041
    ],
    [
      28.613973,
      77.209055
    ]
  ],
  "distanceMeters": 180,
  "pciScore": 15,
  "quality": "very_poor",
  "color": "#EF4444",
  "potholeCount": 22,
  "crackCount": 4,
  "recurrenceCount": 3,
  "lastRepairedDate": "12 Jan 2026",
  "damagePattern": "Severe localized road surface deterioration (22 potholes, avg depth 71.0cm)",
  "repairHistory": [
    {
      "id": "rep-db-01",
      "date": "12 Jan 2026",
      "contractor": "PWD Zonal Asphalt Maintenance",
      "repairType": "Cold-mix emergency asphalt patch",
      "status": "failed",
      "daysUntilFailure": 28,
      "costEstimate": "\u20b985,000",
      "notes": "Patch failed along wheel track line after heavy rainfall."
    }
  ],
  "isRecurringHotspot": true,
  "isFromDatabase": true
};
