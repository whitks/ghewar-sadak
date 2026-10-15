import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, UploadQueueItem, Hazard } from './mockData';

export type { Trip, UploadQueueItem, Hazard };

export interface RoutePoint {
  lat: number;
  lon: number;
  timestamp: number;
}

const memoryStore = new Map<string, string>();

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (err) {
    console.warn(`[storage] AsyncStorage.getItem failed for "${key}", using memory fallback:`, err);
    return memoryStore.get(key) ?? null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  memoryStore.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[storage] AsyncStorage.setItem failed for "${key}", stored in memory only:`, err);
  }
}

async function safeRemoveItem(key: string): Promise<void> {
  memoryStore.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] AsyncStorage.removeItem failed for "${key}":`, err);
  }
}

const KEYS = {
  ONBOARDING_DONE: 'onboarding_done',
  TRIPS: 'trips',
  UPLOAD_QUEUE: 'upload_queue',
  SETTINGS: 'settings',
  HAZARDS: 'hazards',
  LAST_LOCATION: 'last_location',
};

export const storage = {
  async getLastLocation(): Promise<{ latitude: number; longitude: number } | null> {
    const v = await safeGetItem(KEYS.LAST_LOCATION);
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },

  async saveLastLocation(coords: { latitude: number; longitude: number }): Promise<void> {
    if (!coords || typeof coords.latitude !== 'number') return;
    await safeSetItem(KEYS.LAST_LOCATION, JSON.stringify(coords));
  },

  async isOnboardingDone(): Promise<boolean> {
    const v = await safeGetItem(KEYS.ONBOARDING_DONE);
    return v === 'true';
  },

  async setOnboardingDone(): Promise<void> {
    await safeSetItem(KEYS.ONBOARDING_DONE, 'true');
  },

  async getHazards(): Promise<Hazard[]> {
    const v = await safeGetItem(KEYS.HAZARDS);
    if (!v) return [];
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((h) => Boolean(h && h.id)) : [];
    } catch {
      return [];
    }
  },

  async saveHazards(hazards: Hazard[]): Promise<void> {
    const valid = (hazards || []).filter((h) => Boolean(h && h.id));
    await safeSetItem(KEYS.HAZARDS, JSON.stringify(valid));
  },

  async addHazard(hazard: Hazard): Promise<void> {
    if (!hazard || !hazard.id) return;
    const hazards = await storage.getHazards();
    // Update existing or prepend new
    const existingIdx = hazards.findIndex((h) => h?.id === hazard.id);
    if (existingIdx >= 0) {
      hazards[existingIdx] = hazard;
    } else {
      hazards.unshift(hazard);
    }
    // Keep up to 200 hazards locally
    if (hazards.length > 200) {
      hazards.length = 200;
    }
    await storage.saveHazards(hazards);
  },

  async getTrips(): Promise<Trip[]> {
    const v = await safeGetItem(KEYS.TRIPS);
    if (!v) return [];
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((t) => Boolean(t && t.id)) : [];
    } catch {
      return [];
    }
  },

  async saveTrips(trips: Trip[]): Promise<void> {
    const valid = (trips || []).filter((t) => Boolean(t && t.id));
    await safeSetItem(KEYS.TRIPS, JSON.stringify(valid));
  },

  async addTrip(trip: any): Promise<void> {
    if (!trip || !trip.id) return;
    const trips = await storage.getTrips();
    const existingIdx = trips.findIndex((t) => t?.id === trip.id);
    if (existingIdx >= 0) {
      trips[existingIdx] = trip;
    } else {
      trips.unshift(trip);
    }
    await storage.saveTrips(trips);
  },

  async deleteTrip(tripId: string): Promise<void> {
    const trips = await storage.getTrips();
    const updated = trips.filter((t) => t?.id !== tripId);
    await storage.saveTrips(updated);
  },

  async deleteHazard(hazardId: string): Promise<void> {
    const hazards = await storage.getHazards();
    const updated = hazards.filter((h) => h?.id !== hazardId);
    await storage.saveHazards(updated);
  },

  async getUploadQueue(): Promise<UploadQueueItem[]> {
    const v = await safeGetItem(KEYS.UPLOAD_QUEUE);
    return v ? JSON.parse(v) : [];
  },

  async saveUploadQueue(queue: UploadQueueItem[]): Promise<void> {
    await safeSetItem(KEYS.UPLOAD_QUEUE, JSON.stringify(queue));
  },

  async addToQueue(item: UploadQueueItem): Promise<void> {
    const queue = await storage.getUploadQueue();
    queue.push(item);
    await storage.saveUploadQueue(queue);
  },

  async getSettings(): Promise<Record<string, unknown>> {
    const v = await safeGetItem(KEYS.SETTINGS);
    return v ? JSON.parse(v) : {
      autoUpload: true,
      backgroundTracking: false,
      sensorSensitivity: 0.7,
      speedUnit: 'kmh',
    };
  },

  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    await safeSetItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  async clearAll(): Promise<void> {
    await safeRemoveItem(KEYS.TRIPS);
    await safeRemoveItem(KEYS.UPLOAD_QUEUE);
    await safeRemoveItem(KEYS.SETTINGS);
    await safeRemoveItem(KEYS.HAZARDS);
  },
};

export const saveTrip = storage.addTrip;
