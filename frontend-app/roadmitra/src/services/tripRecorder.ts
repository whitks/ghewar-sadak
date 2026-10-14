import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Trip, RoutePoint, storage } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JoltEvent {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  speedKmh: number;
  magnitude: number;
  severity: 'low' | 'medium' | 'high';
}

export interface TripTelemetry {
  isRecording: boolean;
  currentTrip: Trip | null;
  currentSpeed: number; // km/h
  currentGForce: number; // g
  elapsedSeconds: number;
  eventCount: number;
  gpsAccuracy: number | null;
  coords: { lat: number; lon: number } | null;
  lastJolt: JoltEvent | null;
}

export type TelemetryListener = (telemetry: TripTelemetry) => void;

// ---------------------------------------------------------------------------
// Haversine distance (kilometres)
// ---------------------------------------------------------------------------

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// TripRecorderService
// ---------------------------------------------------------------------------

class TripRecorderService {
  private _isRecording = false;
  private _currentTrip: Trip | null = null;
  private _currentSpeed = 0;
  private _currentGForce = 1.0;
  private _elapsedSeconds = 0;
  private _eventCount = 0;
  private _gpsAccuracy: number | null = null;
  private _currentCoords: { lat: number; lon: number } | null = null;
  private _lastJolt: JoltEvent | null = null;

  private _locationSubscription: Location.LocationSubscription | null = null;
  private _accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _listeners: Set<TelemetryListener> = new Set();

  private _lastRoutePoint: { lat: number; lon: number } | null = null;

  /** Accelerometer threshold for pothole/bump shock in g-force */
  private readonly JOLT_THRESHOLD = 1.45;
  /** Cooldown between consecutive bump alerts (ms) */
  private readonly EVENT_COOLDOWN_MS = 1200;
  private _lastEventAt = 0;

  // -------------------------------------------------------------------------
  // Subscriptions & State
  // -------------------------------------------------------------------------

  subscribe(listener: TelemetryListener): () => void {
    this._listeners.add(listener);
    listener(this.getTelemetry());
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notifyListeners(): void {
    const telemetry = this.getTelemetry();
    for (const listener of this._listeners) {
      listener(telemetry);
    }
  }

  getTelemetry(): TripTelemetry {
    return {
      isRecording: this._isRecording,
      currentTrip: this._currentTrip,
      currentSpeed: this._currentSpeed,
      currentGForce: this._currentGForce,
      elapsedSeconds: this._elapsedSeconds,
      eventCount: this._eventCount,
      gpsAccuracy: this._gpsAccuracy,
      coords: this._currentCoords,
      lastJolt: this._lastJolt,
    };
  }

  // Backwards compatibility helper
  getCurrentState() {
    return {
      isRecording: this._isRecording,
      currentTrip: this._currentTrip,
      currentSpeed: this._currentSpeed,
      elapsedSeconds: this._elapsedSeconds,
      eventCount: this._eventCount,
    };
  }

  // -------------------------------------------------------------------------
  // Recording Lifecycle
  // -------------------------------------------------------------------------

  async startRecording(): Promise<void> {
    if (this._isRecording) return;

    const tripId = `trip-${Date.now()}`;
    const startTime = Date.now();

    this._currentTrip = {
      id: tripId,
      startTime,
      distance: 0,
      distanceKm: 0,
      duration: 0,
      events: 0,
      eventCount: 0,
      reportCount: 0,
      uploadStatus: 'pending',
      status: 'active',
      route: [],
    };
    this._isRecording = true;
    this._elapsedSeconds = 0;
    this._eventCount = 0;
    this._currentSpeed = 0;
    this._currentGForce = 1.0;
    this._lastRoutePoint = null;
    this._lastJolt = null;

    // Timer ticker
    this._timerInterval = setInterval(() => {
      this._elapsedSeconds += 1;
      if (this._currentTrip) {
        this._currentTrip.duration = this._elapsedSeconds;
      }
      this._notifyListeners();
    }, 1000);

    // Start real sensors
    await this._startLocationTracking();
    this._startAccelerometerTracking();

    await storage.addTrip(this._currentTrip);
    this._notifyListeners();
  }

  async stopRecording(): Promise<Trip | null> {
    if (!this._isRecording || !this._currentTrip) return null;

    this._isRecording = false;

    // Stop subscriptions
    this._locationSubscription?.remove();
    this._locationSubscription = null;
    this._accelSubscription?.remove();
    this._accelSubscription = null;

    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    Accelerometer.setUpdateInterval(1000);

    // Finalise trip
    this._currentTrip.endTime = Date.now();
    this._currentTrip.status = 'completed';
    this._currentTrip.duration = this._elapsedSeconds;
    this._currentTrip.events = this._eventCount;
    this._currentTrip.distanceKm = Number((this._currentTrip.distance ?? 0).toFixed(2));

    const completedTrip = { ...this._currentTrip };
    await storage.addTrip(completedTrip);

    // Queue trip track for upload
    if (completedTrip.route && completedTrip.route.length > 0) {
      await storage.addToQueue({
        id: `upload-track-${completedTrip.id}`,
        type: 'track',
        status: 'pending',
        attempts: 0,
        createdAt: Date.now(),
        payload: {
          trip_id: completedTrip.id,
          points: completedTrip.route.map((p) => ({
            ts: p.timestamp,
            lat: p.lat,
            lon: p.lon,
            speed_mps: this._currentSpeed / 3.6,
          })),
        },
      });
    }

    // Reset state
    this._currentTrip = null;
    this._currentSpeed = 0;
    this._elapsedSeconds = 0;
    this._eventCount = 0;
    this._lastJolt = null;

    this._notifyListeners();
    return completedTrip;
  }

  // -------------------------------------------------------------------------
  // Sensor Tracking
  // -------------------------------------------------------------------------

  private async _startLocationTracking(): Promise<void> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[TripRecorder] Location permission not granted');
        return;
      }

      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);

      if (initial) {
        this._updateLocation(
          initial.coords.latitude,
          initial.coords.longitude,
          (initial.coords.speed ?? 0) * 3.6,
          initial.coords.accuracy,
        );
      }

      this._locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2, // meters
          timeInterval: 1000,
        },
        (loc) => {
          this._updateLocation(
            loc.coords.latitude,
            loc.coords.longitude,
            (loc.coords.speed ?? 0) * 3.6,
            loc.coords.accuracy,
          );
        },
      );
    } catch (err) {
      console.warn('[TripRecorder] Error setting up location tracking:', err);
    }
  }

  private _updateLocation(
    lat: number,
    lon: number,
    speedKmh: number,
    accuracy: number | null,
  ): void {
    if (!this._isRecording || !this._currentTrip) return;

    this._currentSpeed = Math.max(0, Math.round(speedKmh));
    this._gpsAccuracy = accuracy ? Math.round(accuracy) : null;
    this._currentCoords = { lat, lon };

    if (this._lastRoutePoint) {
      const delta = haversineKm(
        this._lastRoutePoint.lat,
        this._lastRoutePoint.lon,
        lat,
        lon,
      );
      if (delta < 2) {
        this._currentTrip.distance = (this._currentTrip.distance ?? 0) + delta;
        this._currentTrip.distanceKm = Number(this._currentTrip.distance.toFixed(2));
      }
    }

    const point: RoutePoint = { lat, lon, timestamp: Date.now() };
    if (!this._currentTrip.route) {
      this._currentTrip.route = [];
    }
    this._currentTrip.route.push(point);
    this._lastRoutePoint = { lat, lon };

    this._notifyListeners();
  }

  private _startAccelerometerTracking(): void {
    // 50ms interval = 20 Hz
    Accelerometer.setUpdateInterval(50);

    this._accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      this._currentGForce = Number(magnitude.toFixed(2));

      const now = Date.now();
      const deltaFromG = Math.abs(magnitude - 1.0);

      // Detect sharp shock spike (bump or pothole strike)
      if (
        (magnitude > this.JOLT_THRESHOLD || deltaFromG > 0.55) &&
        now - this._lastEventAt > this.EVENT_COOLDOWN_MS
      ) {
        this._lastEventAt = now;
        this._onBumpDetected(magnitude);
      }
    });
  }

  private async _onBumpDetected(magnitude: number): Promise<void> {
    if (!this._isRecording || !this._currentTrip) return;

    // Tactile haptic pulse so the driver physically feels the bump
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Haptics not available on some web platforms
    }

    this._eventCount += 1;
    this._currentTrip.events = this._eventCount;
    this._currentTrip.eventCount = this._eventCount;

    const severity: 'low' | 'medium' | 'high' =
      magnitude > 2.2 ? 'high' : magnitude > 1.7 ? 'medium' : 'low';

    const coords = this._currentCoords ?? { lat: 18.9388, lon: 72.8354 };

    const jolt: JoltEvent = {
      id: `jolt-${Date.now()}`,
      timestamp: Date.now(),
      lat: coords.lat,
      lon: coords.lon,
      speedKmh: this._currentSpeed,
      magnitude: Number(magnitude.toFixed(2)),
      severity,
    };
    this._lastJolt = jolt;

    // Queue real vibration event for upload
    storage.addToQueue({
      id: `upload-event-${jolt.id}`,
      type: 'event',
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      payload: {
        event_id: jolt.id,
        trip_id: this._currentTrip.id,
        ts: jolt.timestamp,
        lat: jolt.lat,
        lon: jolt.lon,
        speed_mps: this._currentSpeed / 3.6,
        source: 'auto',
        candidate_type: 'pothole',
        severity,
        metrics: {
          peak: magnitude,
          peak_to_peak: magnitude * 1.5,
          duration_ms: 120,
        },
      },
    }).catch(() => {});

    // Save as local Hazard so it immediately appears on the Map Radar
    storage.addHazard({
      id: `haz-shock-${jolt.id}`,
      lat: jolt.lat,
      lon: jolt.lon,
      type: 'pothole',
      status: 'unconfirmed',
      confidence: Math.min(0.92, Number((magnitude / 2.6).toFixed(2))),
      severity: Math.min(100, Math.round(magnitude * 36)),
      source: 'phone',
      phoneScore: Number((magnitude / 2.6).toFixed(2)),
      deviceCount: 1,
      lastSeen: new Date().toISOString(),
      description: `${jolt.magnitude}G road shock detected at ${Math.round(jolt.speedKmh)} km/h`,
      magnitude: jolt.magnitude,
      speedKmh: jolt.speedKmh,
    }).catch(() => {});

    this._notifyListeners();
  }
}

export const tripRecorderService = new TripRecorderService();
