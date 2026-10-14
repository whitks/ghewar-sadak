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
};

export const storage = {
  async isOnboardingDone(): Promise<boolean> {
    const v = await safeGetItem(KEYS.ONBOARDING_DONE);
    return v === 'true';
  },

  async setOnboardingDone(): Promise<void> {
    await safeSetItem(KEYS.ONBOARDING_DONE, 'true');
  },

  async getHazards(): Promise<Hazard[]> {
    const v = await safeGetItem(KEYS.HAZARDS);
    return v ? JSON.parse(v) : [];
  },

  async saveHazards(hazards: Hazard[]): Promise<void> {
    await safeSetItem(KEYS.HAZARDS, JSON.stringify(hazards));
  },

  async addHazard(hazard: Hazard): Promise<void> {
    const hazards = await storage.getHazards();
    // Prepend new hazard
    hazards.unshift(hazard);
    // Keep up to 200 hazards locally
    if (hazards.length > 200) {
      hazards.length = 200;
    }
    await storage.saveHazards(hazards);
  },

  async getTrips(): Promise<Trip[]> {
    const v = await safeGetItem(KEYS.TRIPS);
    return v ? JSON.parse(v) : [];
  },

  async saveTrips(trips: Trip[]): Promise<void> {
    await safeSetItem(KEYS.TRIPS, JSON.stringify(trips));
  },

  async addTrip(trip: any): Promise<void> {
    const trips = await storage.getTrips();
    trips.unshift(trip);
    await storage.saveTrips(trips);
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
