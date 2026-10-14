import { API_BASE_URL, API_KEY, ENDPOINTS } from '@/constants/api';
import { MOCK_HAZARDS, Hazard } from './mockData';
import { HazardType } from '@/constants/hazardTypes';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
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
      return await apiFetch<Hazard[]>(`${ENDPOINTS.hazardsNearby}?${params}`);
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
};
