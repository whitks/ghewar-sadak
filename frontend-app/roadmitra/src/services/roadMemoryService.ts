import { Hazard, Trip } from './mockData';
import { haversineMeters } from './roadSegmentation';

export type RoadQualityGrade = 'good' | 'fair' | 'poor' | 'very_poor';

export interface RepairRecord {
  id: string;
  date: string;
  contractor: string;
  repairType: string;
  status: 'failed' | 'deteriorated' | 'stable';
  daysUntilFailure: number;
  costEstimate: string;
  notes: string;
}

export interface RoadMemorySegment {
  id: string;
  tripId?: string;
  roadName: string;
  roadType: 'motorway' | 'primary' | 'secondary' | 'residential' | 'tertiary';
  coordinates: Array<[number, number]>; // [lat, lon]
  distanceMeters: number;
  pciScore: number; // 0 to 100 Pavement Condition Index
  quality: RoadQualityGrade;
  color: string;
  potholeCount: number;
  crackCount: number;
  recurrenceCount: number; // Number of times potholes recurred after official repairs
  lastRepairedDate: string;
  damagePattern: string;
  repairHistory: RepairRecord[];
  isRecurringHotspot: boolean;
  isSimulated?: boolean;
  isFromDatabase?: boolean;
}

export const PCI_COLORS: Record<RoadQualityGrade, string> = {
  good: '#22C55E',       // Green (PCI 80-100): Healthy / Verified Smooth
  fair: '#EAB308',       // Yellow (PCI 60-79): Moderate wear / Superficial aging
  poor: '#F97316',       // Orange (PCI 40-59): Poor / Recurring cracks & minor dips
  very_poor: '#EF4444',  // Red (PCI 10-39): Critical / High Recurrence Damage Hotspot
};

export function getQualityFromPci(pci: number): RoadQualityGrade {
  if (pci >= 80) return 'good';
  if (pci >= 60) return 'fair';
  if (pci >= 40) return 'poor';
  return 'very_poor';
}

/**
 * Generates an interconnected road corridor network around the user's current GPS location.
 * Combines real telemetry data with a simulated "Road Memory" prototype of recurring damage
 * to identify infrastructure failures, repair history, and chronic potholes.
 */
export function generateRoadMemorySegments(
  centerCoords: { latitude: number; longitude: number },
  realHazards: Hazard[] = [],
  realTrips: Trip[] = []
): RoadMemorySegment[] {
  const { latitude: lat, longitude: lon } = centerCoords;

  // Offset helpers (~100m ≈ 0.0009 deg latitude, ~0.001 deg longitude)
  const dLat = (meters: number) => meters / 111320;
  const dLon = (meters: number) => meters / (111320 * Math.cos((lat * Math.PI) / 180));

  // Seed archetypes for realistic road layout surrounding current coordinates
  const corridors = [
    // 1. Central Arterial Expressway (North-South) - Chronic monsoon drainage failure
    {
      name: 'North-South Arterial Highway',
      type: 'primary' as const,
      pci: 28,
      recurrence: 4,
      cracks: 7,
      potholes: 5,
      lastRepaired: '18 Jan 2026',
      pattern: 'Sub-base saturation from inadequate shoulder drainage & heavy axle traffic',
      history: [
        {
          id: 'rep-01',
          date: '18 Jan 2026',
          contractor: 'Apex Infra PWD',
          repairType: 'Cold-mix bitumen patch',
          status: 'failed' as const,
          daysUntilFailure: 32,
          costEstimate: '₹65,000',
          notes: 'Pothole re-formed in identical wheel-path location after rain.',
        },
        {
          id: 'rep-02',
          date: '14 Sep 2025',
          contractor: 'City Road Maintenance Unit',
          repairType: 'Surface milling & 40mm asphalt overlay',
          status: 'failed' as const,
          daysUntilFailure: 84,
          costEstimate: '₹3,40,000',
          notes: 'Reflective cracking occurred along underlying joint.',
        },
        {
          id: 'rep-03',
          date: '22 Mar 2025',
          contractor: 'Metro Highways Ltd',
          repairType: 'Tack coat & stone mastic asphalt',
          status: 'failed' as const,
          daysUntilFailure: 110,
          costEstimate: '₹5,20,000',
          notes: 'Rutting and edge raveling observed near bus stop bay.',
        },
      ],
      points: [
        [-280, -20],
        [-190, -15],
        [-100, -8],
        [-10, 0],
        [80, 5],
        [170, 12],
        [260, 20],
      ],
    },

    // 2. East-West Secondary Corridor - Utility trench subsidence hotspot
    {
      name: 'East Sector Link Road',
      type: 'secondary' as const,
      pci: 34,
      recurrence: 3,
      cracks: 4,
      potholes: 4,
      lastRepaired: '05 Feb 2026',
      pattern: 'Poor soil compaction post-utility pipeline trenching',
      history: [
        {
          id: 'rep-04',
          date: '05 Feb 2026',
          contractor: 'Municipal Utility Repair Cell',
          repairType: 'Quick-setting patch mortar',
          status: 'failed' as const,
          daysUntilFailure: 21,
          costEstimate: '₹42,000',
          notes: 'Settlement depression re-emerged along sewer trench line.',
        },
        {
          id: 'rep-05',
          date: '12 Nov 2025',
          contractor: 'Swastik Roadworks',
          repairType: 'Granular sub-base restoration',
          status: 'deteriorated' as const,
          daysUntilFailure: 65,
          costEstimate: '₹1,80,000',
          notes: 'Edge breaking and alligator cracks visible across lanes.',
        },
      ],
      points: [
        [-15, -290],
        [-10, -190],
        [-5, -100],
        [0, 0],
        [5, 90],
        [12, 190],
        [20, 280],
      ],
    },

    // 3. Ring Road Bypass Curve - High centrifugal stress
    {
      name: 'Outer Bypass Crescent',
      type: 'motorway' as const,
      pci: 48,
      recurrence: 2,
      cracks: 3,
      potholes: 2,
      lastRepaired: '28 Nov 2025',
      pattern: 'Surface shear stripping from high-speed turning friction',
      history: [
        {
          id: 'rep-06',
          date: '28 Nov 2025',
          contractor: 'NHAI Maintenance Circle',
          repairType: 'Polymer modified bitumen overlay',
          status: 'deteriorated' as const,
          daysUntilFailure: 92,
          costEstimate: '₹4,10,000',
          notes: 'Fine aggregate loss in curved superelevation section.',
        },
      ],
      points: [
        [-220, 160],
        [-150, 210],
        [-70, 240],
        [10, 250],
        [100, 230],
        [180, 190],
        [240, 130],
      ],
    },

    // 4. Commercial Market Avenue - Moderate wear
    {
      name: 'Market Central Avenue',
      type: 'secondary' as const,
      pci: 68,
      recurrence: 1,
      cracks: 2,
      potholes: 1,
      lastRepaired: '10 Dec 2025',
      pattern: 'Stop-and-go delivery vehicle braking wear',
      history: [
        {
          id: 'rep-07',
          date: '10 Dec 2025',
          contractor: 'Zonal PWD Contractor',
          repairType: 'Hot poured crack seal & patch',
          status: 'stable' as const,
          daysUntilFailure: 140,
          costEstimate: '₹55,000',
          notes: 'Patch holding; slight edge wearing near intersection.',
        },
      ],
      points: [
        [150, -260],
        [120, -170],
        [90, -80],
        [70, 10],
        [50, 100],
      ],
    },

    // 5. Residential Green Boulevard - Well-maintained / Smooth
    {
      name: 'Parkview Residential Boulevard',
      type: 'residential' as const,
      pci: 88,
      recurrence: 0,
      cracks: 0,
      potholes: 0,
      lastRepaired: '02 Oct 2025',
      pattern: 'Zero structural failure; optimal surface drainage slope',
      history: [
        {
          id: 'rep-08',
          date: '02 Oct 2025',
          contractor: 'Green City Infra',
          repairType: 'Routine micro-surfacing maintenance',
          status: 'stable' as const,
          daysUntilFailure: 220,
          costEstimate: '₹95,000',
          notes: 'Smooth texture, zero pothole recurrence reported.',
        },
      ],
      points: [
        [-240, -180],
        [-170, -140],
        [-100, -110],
        [-30, -80],
        [40, -50],
        [110, -20],
      ],
    },

    // 6. University / Tech Campus Link - Good condition
    {
      name: 'Campus Access Expressway',
      type: 'tertiary' as const,
      pci: 92,
      recurrence: 0,
      cracks: 0,
      potholes: 0,
      lastRepaired: '15 Aug 2025',
      pattern: 'Concrete paver base with reinforced geo-textile membrane',
      history: [
        {
          id: 'rep-09',
          date: '15 Aug 2025',
          contractor: 'L&T Urban Roads',
          repairType: 'Full pavement rejuvenation',
          status: 'stable' as const,
          daysUntilFailure: 260,
          costEstimate: '₹2,30,000',
          notes: 'Excellent ride quality index. No recurring defects.',
        },
      ],
      points: [
        [-80, 50],
        [-40, 110],
        [0, 170],
        [40, 230],
        [80, 290],
      ],
    },
  ];

  const segments: RoadMemorySegment[] = [];

  // Convert each corridor's relative meter waypoints into ~100m road segments
  corridors.forEach((corridor, cIdx) => {
    for (let i = 0; i < corridor.points.length - 1; i++) {
      const p1 = corridor.points[i];
      const p2 = corridor.points[i + 1];

      const lat1 = lat + dLat(p1[0]);
      const lon1 = lon + dLon(p1[1]);
      const lat2 = lat + dLat(p2[0]);
      const lon2 = lon + dLon(p2[1]);

      const dist = haversineMeters(lat1, lon1, lat2, lon2);

      // Minor realistic variation per segment slice along the corridor
      const variation = ((cIdx + i) % 3) * 4 - 4;
      const segPci = Math.max(12, Math.min(98, corridor.pci + variation));
      const quality = getQualityFromPci(segPci);
      const color = PCI_COLORS[quality];

      // Check if any real hazard logged by user falls on this segment
      const nearbyRealHazards = realHazards.filter((h) => {
        const d1 = haversineMeters(h.lat, h.lon, lat1, lon1);
        const d2 = haversineMeters(h.lat, h.lon, lat2, lon2);
        return Math.min(d1, d2) < 45;
      });

      const finalPotholes = corridor.potholes + nearbyRealHazards.length;
      const isRecurring = corridor.recurrence >= 2;

      segments.push({
        id: `seg-mem-${cIdx}-${i}`,
        roadName: `${corridor.name} (Sec ${i + 1})`,
        roadType: corridor.type,
        coordinates: [
          [lat1, lon1],
          [lat2, lon2],
        ],
        distanceMeters: Math.round(dist),
        pciScore: segPci,
        quality,
        color,
        potholeCount: finalPotholes,
        crackCount: corridor.cracks,
        recurrenceCount: corridor.recurrence,
        lastRepairedDate: corridor.lastRepaired,
        damagePattern: corridor.pattern,
        repairHistory: corridor.history,
        isRecurringHotspot: isRecurring,
        isSimulated: true,
      });
    }
  });

  return segments;
}

/**
 * Generates a minimal, clean, sparse set of defect points situated directly
 * along the surveyed road corridor lines rather than a cluttered cloud of pins.
 */
export function generateSparseRoadLineHazards(
  centerCoords: { latitude: number; longitude: number },
  deletedIds: Set<string> = new Set()
): Hazard[] {
  const { latitude: lat, longitude: lon } = centerCoords;
  const dLat = (meters: number) => meters / 111320;
  const dLon = (meters: number) => meters / (111320 * Math.cos((lat * Math.PI) / 180));

  const candidateHazards: Hazard[] = [
    {
      id: 'haz-line-01',
      lat: lat + dLat(-100),
      lon: lon + dLon(-8),
      type: 'pothole',
      status: 'confirmed',
      confidence: 0.91,
      severity: 85,
      source: 'both',
      cameraScore: 0.88,
      phoneScore: 0.84,
      deviceCount: 4,
      lastSeen: new Date(Date.now() - 3600000).toISOString(),
      description: 'Severe pothole on North-South Arterial Highway; high vibration impact verified.',
      magnitude: 1.85,
      speedKmh: 42,
    },
    {
      id: 'haz-line-02',
      lat: lat + dLat(80),
      lon: lon + dLon(5),
      type: 'alligator_crack',
      status: 'probable',
      confidence: 0.74,
      severity: 55,
      source: 'camera',
      cameraScore: 0.78,
      deviceCount: 2,
      lastSeen: new Date(Date.now() - 7200000).toISOString(),
      description: 'Fatigue cracking along arterial corridor shoulder.',
      magnitude: 1.25,
      speedKmh: 48,
    },
    {
      id: 'haz-line-03',
      lat: lat + dLat(0),
      lon: lon + dLon(0),
      type: 'rough_patch',
      status: 'confirmed',
      confidence: 0.82,
      severity: 68,
      source: 'phone',
      phoneScore: 0.85,
      deviceCount: 5,
      lastSeen: new Date(Date.now() - 1800000).toISOString(),
      description: 'East Sector Link Road intersection: sustained vertical vibration.',
      magnitude: 1.62,
      speedKmh: 35,
    },
    {
      id: 'haz-line-04',
      lat: lat + dLat(100),
      lon: lon + dLon(230),
      type: 'transverse_crack',
      status: 'probable',
      confidence: 0.65,
      severity: 45,
      source: 'both',
      cameraScore: 0.70,
      phoneScore: 0.60,
      deviceCount: 2,
      lastSeen: new Date(Date.now() - 10800000).toISOString(),
      description: 'Transverse thermal crack across Outer Bypass crescent lane.',
      magnitude: 1.18,
      speedKmh: 55,
    },
  ];

  return candidateHazards.filter((h) => !deletedIds.has(h.id));
}

