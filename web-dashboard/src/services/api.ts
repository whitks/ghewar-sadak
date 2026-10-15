import type { RoadDefect, DashboardStats } from '../types';
import { INITIAL_INDIAN_DEFECTS, computeStats } from '../data/mockIndianRoads';

export const API_BASE_URL = 'https://ghewar-sadak.onrender.com';

const STORAGE_KEY = 'roadmitra_pwd_defects_v1';

export class RoadDistressService {
  private static localOverrides: Map<string | number, Partial<RoadDefect>> = new Map();

  static getStoredOverrides(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.localOverrides = new Map(Object.entries(parsed));
      }
    } catch {
      // Ignored
    }
  }

  static saveOverrides(): void {
    try {
      const obj = Object.fromEntries(this.localOverrides.entries());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignored
    }
  }

  /**
   * Fetch defects from Render backend, merging with rich Indian road corridor telemetry
   */
  static async fetchAllDefects(): Promise<{ defects: RoadDefect[]; stats: DashboardStats; isLive: boolean }> {
    this.getStoredOverrides();

    let backendRecords: any[] = [];
    let isLive = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout so dashboard stays snappy

      const res = await fetch(`${API_BASE_URL}/api/potholes?limit=50`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          backendRecords = json.data;
          isLive = true;
        }
      }
    } catch (err) {
      console.info('[RoadMitra Web] Backend cold or offline, using high-fidelity Indian PWD dataset.');
    }

    // Convert backend SQLite rows to typed RoadDefects
    const liveDefects: RoadDefect[] = backendRecords.map((r, idx) => {
      const isCritical = r.severity === 'Critical' || (r.estimated_depth_cm && r.estimated_depth_cm > 6.0);
      const isModerate = r.severity === 'Moderate' || (r.estimated_depth_cm && r.estimated_depth_cm >= 3.0);
      const severity = isCritical ? 'Critical' : isModerate ? 'Moderate' : (r.severity || 'High');

      const fullAnnotatedUrl = r.annotated_image_path
        ? `${API_BASE_URL}/api/images/annotated/${r.annotated_image_path.split(/[\\/]/).pop()}`
        : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1000&auto=format&fit=crop&q=80';

      const fullFrameUrl = r.frame_image_path
        ? `${API_BASE_URL}/api/images/frames/${r.frame_image_path.split(/[\\/]/).pop()}`
        : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1000&auto=format&fit=crop&q=80';

      return {
        id: `LIVE-${r.id || idx + 1}`,
        timestamp: r.timestamp || new Date().toISOString(),
        roadName: `Delhi PWD Sector Corridors (Point #${r.id || idx + 1})`,
        landmark: `Lat: ${r.latitude?.toFixed(4)}, Lon: ${r.longitude?.toFixed(4)} (GPS Track)`,
        wardZone: 'Delhi PWD Central Division',
        city: 'New Delhi',
        latitude: r.latitude || 28.6139,
        longitude: r.longitude || 77.2090,
        altitude: r.altitude || 216,
        speedKmh: r.speed_kmh || 38.0,
        className: (r.class_name as any) || 'Pothole',
        confidence: Number(r.confidence || 0.85),
        estimatedDepthCm: Number(r.estimated_depth_cm || 5.2),
        depthClass: r.depth_class || 'Deep (>5cm)',
        severity: severity as any,
        repairUrgency: severity === 'Critical' ? 'Fix ASAP (Within 24 Hours)' : 'Priority Repair (24-48 Hours)',
        status: 'Reported',
        assignedContractor: 'Delhi PWD Emergency Asphalt Unit',
        slaDeadlineHours: severity === 'Critical' ? 24 : 48,
        estimatedAsphaltKg: Math.round((r.estimated_depth_cm || 5) * 28),
        frameImageUrl: fullFrameUrl,
        annotatedImageUrl: fullAnnotatedUrl,
        notes: r.notes || 'Captured by vehicle dashcam and verified by AI vision.',
        isNewToday: true,
      };
    });

    // Combine realistic Indian road records with live backend records
    let combined = [...liveDefects, ...INITIAL_INDIAN_DEFECTS];

    // Apply any local work-order or status overrides made by the official
    combined = combined.map((d) => {
      const override = this.localOverrides.get(String(d.id));
      if (override) {
        return { ...d, ...override };
      }
      return d;
    });

    // Sort: Critical / High first, then newest
    combined.sort((a, b) => {
      const sevOrder: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
      const diff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
      if (diff !== 0) return diff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const stats = computeStats(combined);
    return { defects: combined, stats, isLive };
  }

  /**
   * Update status of a road defect (e.g., Mark as Work Order Issued or Repaired)
   */
  static updateDefectStatus(
    defectId: string | number,
    newStatus: RoadDefect['status'],
    contractor?: string
  ): void {
    const existing = this.localOverrides.get(String(defectId)) || {};
    this.localOverrides.set(String(defectId), {
      ...existing,
      status: newStatus,
      assignedContractor: contractor || existing.assignedContractor || 'PWD Asphalt QRT',
    });
    this.saveOverrides();
  }

  /**
   * Add a newly reported pothole by official or citizen
   */
  static addManualDefect(defect: Omit<RoadDefect, 'id'>): RoadDefect {
    const newId = `MANUAL-${Date.now()}`;
    const fullDefect: RoadDefect = {
      ...defect,
      id: newId,
      isNewToday: true,
    };
    this.localOverrides.set(newId, fullDefect);
    this.saveOverrides();
    return fullDefect;
  }

  /**
   * Export PWD Work Orders as CSV
   */
  static exportWorkOrdersCSV(defects: RoadDefect[]): void {
    const headers = [
      'Defect ID',
      'Road Name',
      'Landmark',
      'Ward / Zone',
      'Defect Type',
      'Severity',
      'Depth (cm)',
      'Estimated Asphalt (kg)',
      'Repair Urgency',
      'SLA Hours',
      'Contractor',
      'Status',
      'GPS Latitude',
      'GPS Longitude',
      'Timestamp',
    ];

    const rows = defects.map((d) => [
      `"${d.id}"`,
      `"${d.roadName}"`,
      `"${d.landmark.replace(/"/g, '""')}"`,
      `"${d.wardZone}"`,
      `"${d.className}"`,
      `"${d.severity}"`,
      d.estimatedDepthCm,
      d.estimatedAsphaltKg,
      `"${d.repairUrgency}"`,
      d.slaDeadlineHours,
      `"${d.assignedContractor || 'Unassigned'}"`,
      `"${d.status}"`,
      d.latitude,
      d.longitude,
      `"${d.timestamp}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PWD_Road_Distress_Work_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
