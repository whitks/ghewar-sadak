import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { Trip, RoutePoint, TripImage, storage } from './storage';

// ---------------------------------------------------------------------------
// Detection & Vibration Algorithm Constants
// ---------------------------------------------------------------------------

/** Sampling interval: 20 ms = 50 Hz sampling rate */
const SAMPLING_INTERVAL_MS = 20;

/** Circular buffer length for rolling RMS computation (50 samples @ 50 Hz = 1.0 s) */
const RMS_BUFFER_SIZE = 50;

/** Minimum consecutive dynamic samples to qualify as a shock (1 sample = 20ms at 50Hz) */
const MIN_SPIKE_SAMPLES = 1;

/** Maximum spike duration for single impact (25 samples @ 50 Hz = 500 ms) */
const MAX_SPIKE_SAMPLES = 25;

/** Dynamic RMS threshold above which a road section is classified as rough */
const PATCH_RMS_THRESHOLD = 0.18; // in g of dynamic vibration

/** Cooldown between consecutive sharp bump alerts (ms) */
const BUMP_COOLDOWN_MS = 1000;

/** Cooldown between consecutive rough patch alerts (ms) */
const PATCH_COOLDOWN_MS = 3500;

/** Proximity dedup radius in metres for bumps */
const BUMP_DEDUP_RADIUS_M = 10;

/** Proximity dedup radius in metres for rough patches */
const PATCH_DEDUP_RADIUS_M = 20;

/**
 * Low-pass filter smoothing coefficient for gravity vector isolation.
 * At 50 Hz (dt = 0.02s), alpha = 0.92 gives tau ≈ 0.23s,
 * keeping gravity stable while isolating vehicle vibration.
 */
const GRAVITY_LPF_ALPHA = 0.92;

/**
 * Speed-adaptive dynamic acceleration threshold for road shocks.
 * Calibrated for genuine pothole/bump detection without missing shocks during hand/desk testing.
 */
function adaptiveShockThreshold(speedKmh: number): number {
  // If GPS is stationary or unacquired, use 0.32g (responsive for testing and city roads)
  if (speedKmh <= 0) return 0.32;
  if (speedKmh < 15) return 0.36; // low speed crawling
  if (speedKmh < 50) return 0.30; // standard city driving
  if (speedKmh < 80) return 0.25; // arterial / suburban
  return 0.20;                   // highway: high vehicle momentum, even small jolts are real
}

/** Haversine distance between two GPS points in metres. */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Haversine distance in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineM(lat1, lon1, lat2, lon2) / 1000;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DefectType = 'pothole' | 'speed_breaker';

export interface JoltEvent {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  speedKmh: number;
  magnitude: number;        // peak dynamic g
  verticalG: number;        // vertical shock g
  horizontalG: number;      // lateral/longitudinal g
  totalG: number;           // raw total g
  defectType: DefectType;   // pothole vs speed breaker
  estimatedDepthCm: number; // estimated physical depression/bump size in cm
  severity: 'low' | 'medium' | 'high';
}

export interface PatchEvent {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  speedKmh: number;
  avgRms: number;
  durationSec: number;
  severity: 'low' | 'medium' | 'high';
}

export type RoadCondition = 'smooth' | 'good' | 'moderate' | 'rough';

export interface TripTelemetry {
  isRecording: boolean;
  currentTrip: Trip | null;
  currentSpeed: number; // km/h
  currentGForce: number; // raw total g (~1.0 at rest)
  dynamicGForce: number; // dynamic vibration g (~0.0 at rest)
  verticalGForce: number; // isolated vertical acceleration g
  horizontalGForce: number; // horizontal lateral/longitudinal acceleration g
  angularVelocity: number; // phone rotational velocity in rad/s
  vibrationRms: number; // rolling 1-second vibration RMS (g)
  roadQuality: RoadCondition;
  roadQualityScore: number; // 0 (terrible) to 100 (silky smooth)
  elapsedSeconds: number;
  eventCount: number; // total road defects (bumps + patches)
  shockCount: number; // total shock strikes
  potholeCount: number; // classified potholes
  speedBreakerCount: number; // classified speed breakers
  patchCount: number; // sustained rough road patches
  gpsAccuracy: number | null;
  coords: { lat: number; lon: number } | null;
  lastJolt: JoltEvent | null;
  lastPatch: PatchEvent | null;
  images?: TripImage[];
}

export type TelemetryListener = (telemetry: TripTelemetry) => void;

// ---------------------------------------------------------------------------
// TripRecorderService
// ---------------------------------------------------------------------------

class TripRecorderService {
  private _isRecording = false;
  private _currentTrip: Trip | null = null;
  private _currentSpeed = 0;
  private _currentGForce = 1.0;
  private _dynamicGForce = 0.0;
  private _verticalGForce = 0.0;
  private _horizontalGForce = 0.0;
  private _angularVelocity = 0.0;
  private _vibrationRms = 0.04;
  private _roadQuality: RoadCondition = 'smooth';
  private _roadQualityScore = 95;
  private _elapsedSeconds = 0;
  private _shockCount = 0;
  private _potholeCount = 0;
  private _speedBreakerCount = 0;
  private _patchCount = 0;
  private _eventCount = 0;
  private _gpsAccuracy: number | null = null;
  private _currentCoords: { lat: number; lon: number } | null = null;
  private _lastJolt: JoltEvent | null = null;
  private _lastPatch: PatchEvent | null = null;

  private _locationSubscription: Location.LocationSubscription | null = null;
  private _accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private _gyroSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;
  private _timerInterval: ReturnType<typeof setInterval> | null = null;
  private _listeners: Set<TelemetryListener> = new Set();
  private _lastRoutePoint: { lat: number; lon: number } | null = null;
  private _lastRouteTimestamp = 0;

  // ── Gravity Separation & Spatial Decomposition State ─────────────────────
  private _gravity = { x: 0, y: 0, z: 1.0 };
  private _gravityInit = false;
  private _dynamicMagBuffer: number[] = [];
  private _previousDynMag = 0.0;

  // ── Shock (Pothole/Bump) Detection State ──────────────────────────────────
  private _inSpike = false;
  private _spikeSamples = 0;
  private _spikePeakDyn = 0;
  private _spikePeakVert = 0;
  private _spikePeakRaw = 1.0;
  private _spikePeakHoriz = 0;
  private _spikeMaxJerk = 0;
  private _lastBumpAt = 0;
  private _lastBumpCoords: { lat: number; lon: number } | null = null;

  // ── Rough Patch Leaky Integrator State ───────────────────────────────────
  private _patchScore = 0; // accumulates on rough samples, decays on smooth
  private _patchSamplesInSustained = 0;
  private _patchRmsSum = 0;
  private _lastPatchAt = 0;
  private _lastPatchCoords: { lat: number; lon: number } | null = null;

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
      dynamicGForce: this._dynamicGForce,
      verticalGForce: this._verticalGForce,
      horizontalGForce: this._horizontalGForce,
      angularVelocity: this._angularVelocity,
      vibrationRms: this._vibrationRms,
      roadQuality: this._roadQuality,
      roadQualityScore: this._roadQualityScore,
      elapsedSeconds: this._elapsedSeconds,
      eventCount: this._eventCount,
      shockCount: this._shockCount,
      potholeCount: this._potholeCount,
      speedBreakerCount: this._speedBreakerCount,
      patchCount: this._patchCount,
      gpsAccuracy: this._gpsAccuracy,
      coords: this._currentCoords,
      lastJolt: this._lastJolt,
      lastPatch: this._lastPatch,
      images: this._currentTrip?.images ?? [],
    };
  }

  addTripImage(image: TripImage): void {
    if (!this._currentTrip) return;
    if (!this._currentTrip.images) {
      this._currentTrip.images = [];
    }
    const exists = this._currentTrip.images.some((img) => img.uri === image.uri);
    if (!exists) {
      this._currentTrip.images.unshift(image);
      if (this._currentTrip.images.length > 50) {
        this._currentTrip.images.pop();
      }
      this._notifyListeners();
    }
  }

  getCurrentTripImages(): TripImage[] {
    return this._currentTrip?.images ?? [];
  }

  getCurrentState() {
    return {
      isRecording: this._isRecording,
      currentTrip: this._currentTrip,
      currentSpeed: this._currentSpeed,
      elapsedSeconds: this._elapsedSeconds,
      eventCount: this._eventCount,
    };
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  async startTrip(): Promise<void> {
    return this.startRecording();
  }

  async stopTrip(): Promise<Trip | null> {
    return this.stopRecording();
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
      images: [],
    };
    this._isRecording = true;
    this._elapsedSeconds = 0;
    this._shockCount = 0;
    this._potholeCount = 0;
    this._speedBreakerCount = 0;
    this._patchCount = 0;
    this._eventCount = 0;
    this._currentSpeed = 0;
    this._currentGForce = 1.0;
    this._dynamicGForce = 0.0;
    this._verticalGForce = 0.0;
    this._horizontalGForce = 0.0;
    this._angularVelocity = 0.0;
    this._vibrationRms = 0.04;
    this._roadQuality = 'smooth';
    this._roadQualityScore = 95;
    this._lastRoutePoint = null;
    this._lastRouteTimestamp = 0;
    this._lastJolt = null;
    this._lastPatch = null;

    // Reset sensor filter state
    this._gravityInit = false;
    this._gravity = { x: 0, y: 0, z: 1.0 };
    this._dynamicMagBuffer = [];
    this._previousDynMag = 0.0;
    this._inSpike = false;
    this._spikeSamples = 0;
    this._spikePeakDyn = 0;
    this._spikePeakVert = 0;
    this._spikePeakRaw = 1.0;
    this._spikePeakHoriz = 0;
    this._spikeMaxJerk = 0;
    this._patchScore = 0;
    this._patchSamplesInSustained = 0;
    this._patchRmsSum = 0;
    this._lastBumpCoords = null;
    this._lastPatchCoords = null;
    this._lastBumpAt = 0;
    this._lastPatchAt = 0;

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
    this._startGyroscopeTracking();

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
    this._gyroSubscription?.remove();
    this._gyroSubscription = null;

    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    Accelerometer.setUpdateInterval(1000);
    Gyroscope.setUpdateInterval(1000);

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
    this._shockCount = 0;
    this._potholeCount = 0;
    this._speedBreakerCount = 0;
    this._patchCount = 0;
    this._lastRoutePoint = null;
    this._lastRouteTimestamp = 0;
    this._lastJolt = null;
    this._lastPatch = null;
    this._dynamicMagBuffer = [];

    this._notifyListeners();
    return completedTrip;
  }

  // -------------------------------------------------------------------------
  // Location Tracking
  // -------------------------------------------------------------------------

  private async _startLocationTracking(): Promise<void> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[TripRecorder] Location permission not granted');
        return;
      }

      this._locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 3, // meters minimum displacement
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

    const now = Date.now();
    this._currentCoords = { lat, lon };
    this._gpsAccuracy = accuracy ? Math.round(accuracy) : null;
    this._currentSpeed = Math.max(0, Math.round(speedKmh));

    // 1. Accuracy gate: reject fixes with accuracy worse than 25m
    // (Indoor multipath, cell tower triangulation, or satellite acquisition phase)
    const isAccurate = accuracy !== null && accuracy <= 25;
    if (!isAccurate) {
      this._notifyListeners();
      return;
    }

    // 2. Initialize route on first accurate satellite lock
    if (!this._lastRoutePoint) {
      this._lastRoutePoint = { lat, lon };
      this._lastRouteTimestamp = now;
      if (!this._currentTrip.route) {
        this._currentTrip.route = [];
      }
      this._currentTrip.route.push({ lat, lon, timestamp: now });
      this._notifyListeners();
      return;
    }

    // 3. Compute distance and time from previous recorded point
    const deltaKm = haversineKm(
      this._lastRoutePoint.lat,
      this._lastRoutePoint.lon,
      lat,
      lon,
    );
    const deltaMeters = deltaKm * 1000;
    const timeElapsedSec = Math.max(1, (now - this._lastRouteTimestamp) / 1000);
    const impliedSpeedKmh = deltaKm / (timeElapsedSec / 3600);

    // 4. Teleport / Cold-start anomaly check (e.g. jumped >150m at impossible speed >130 km/h)
    if (deltaMeters > 150 && impliedSpeedKmh > 130) {
      // If we only have 1 point so far, the first point was likely a stale cell-tower cache.
      // Reset the start point to this real GPS coordinate without accumulating false distance.
      if (this._currentTrip.route && this._currentTrip.route.length <= 1) {
        this._currentTrip.route = [{ lat, lon, timestamp: now }];
        this._currentTrip.distance = 0;
        this._currentTrip.distanceKm = 0;
        this._lastRoutePoint = { lat, lon };
        this._lastRouteTimestamp = now;
      }
      // Outlier jump ignored
      this._notifyListeners();
      return;
    }

    // 5. Stationary Filter (Zero-displacement Noise Gate):
    // When the phone is at one place / indoors / at a red light:
    // GPS jitter is typically 3-10m with speed near 0.
    // If movement is under noise floor (or speed < 3.5 km/h with displacement < 15m),
    // the phone is stationary. Do NOT add to distance, do NOT add jitter lines to route!
    const effectiveNoiseFloor = Math.max(8, (accuracy ?? 15) * 0.75);
    if (deltaMeters < effectiveNoiseFloor || (this._currentSpeed < 3.5 && deltaMeters < 15)) {
      this._notifyListeners();
      return;
    }

    // 6. Valid road progression: accumulate distance and record route point
    if (deltaMeters < 500) {
      this._currentTrip.distance = (this._currentTrip.distance ?? 0) + deltaKm;
      this._currentTrip.distanceKm = Number(this._currentTrip.distance.toFixed(2));

      if (!this._currentTrip.route) {
        this._currentTrip.route = [];
      }
      this._currentTrip.route.push({ lat, lon, timestamp: now });
      this._lastRoutePoint = { lat, lon };
      this._lastRouteTimestamp = now;
    }

    this._notifyListeners();
  }

  // -------------------------------------------------------------------------
  // Gyroscope Tracking
  // -------------------------------------------------------------------------

  private async _startGyroscopeTracking(): Promise<void> {
    try {
      const isAvailable = await Gyroscope.isAvailableAsync();
      if (!isAvailable) return;

      Gyroscope.setUpdateInterval(SAMPLING_INTERVAL_MS);
      this._gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
        if (!this._isRecording) return;
        const radS = Math.sqrt(x * x + y * y + z * z);
        this._angularVelocity = Number(radS.toFixed(2));
      });
    } catch (err) {
      console.warn('[TripRecorder] Gyroscope setup warning:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Accelerometer & Vibration Signal Processing Engine
  // -------------------------------------------------------------------------

  private _startAccelerometerTracking(): void {
    Accelerometer.setUpdateInterval(SAMPLING_INTERVAL_MS);

    this._accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      if (!this._isRecording) return;

      const totalRaw = Math.sqrt(x * x + y * y + z * z);
      this._currentGForce = Number(totalRaw.toFixed(2));

      // ── Step 1: Isolate Gravity Vector via Low-Pass Filter ──────────────
      if (!this._gravityInit) {
        this._gravity = { x, y, z };
        this._gravityInit = true;
      } else {
        this._gravity.x = GRAVITY_LPF_ALPHA * this._gravity.x + (1 - GRAVITY_LPF_ALPHA) * x;
        this._gravity.y = GRAVITY_LPF_ALPHA * this._gravity.y + (1 - GRAVITY_LPF_ALPHA) * y;
        this._gravity.z = GRAVITY_LPF_ALPHA * this._gravity.z + (1 - GRAVITY_LPF_ALPHA) * z;
      }

      const gMag = Math.sqrt(
        this._gravity.x * this._gravity.x +
        this._gravity.y * this._gravity.y +
        this._gravity.z * this._gravity.z,
      ) || 1.0;

      const gUnitX = this._gravity.x / gMag;
      const gUnitY = this._gravity.y / gMag;
      const gUnitZ = this._gravity.z / gMag;

      // ── Step 2: Linear Dynamic Acceleration (Vehicle Vibration Vector) ───
      const dynX = x - this._gravity.x;
      const dynY = y - this._gravity.y;
      const dynZ = z - this._gravity.z;
      const dynamicMag = Math.sqrt(dynX * dynX + dynY * dynY + dynZ * dynZ);
      this._dynamicGForce = Number(dynamicMag.toFixed(2));

      // ── Step 3: Spatial Decomposition (Vertical vs Horizontal) ───────────
      // Signed vertical acceleration (along gravity vector)
      const verticalG = dynX * gUnitX + dynY * gUnitY + dynZ * gUnitZ;
      this._verticalGForce = Number(verticalG.toFixed(2));

      // Horizontal component (lateral/longitudinal)
      const horizX = dynX - verticalG * gUnitX;
      const horizY = dynY - verticalG * gUnitY;
      const horizZ = dynZ - verticalG * gUnitZ;
      const horizontalG = Math.sqrt(horizX * horizX + horizY * horizY + horizZ * horizZ);
      this._horizontalGForce = Number(horizontalG.toFixed(2));

      // ── Step 4: Jerk (Rate of change of acceleration: da/dt) ─────────────
      const jerk = Math.abs(dynamicMag - this._previousDynMag) / (SAMPLING_INTERVAL_MS / 1000);
      this._previousDynMag = dynamicMag;

      // ── Step 5: Rolling RMS Vibration Energy (1-second sliding window) ───
      this._dynamicMagBuffer.push(dynamicMag);
      if (this._dynamicMagBuffer.length > RMS_BUFFER_SIZE) {
        this._dynamicMagBuffer.shift();
      }

      let sumSquares = 0;
      for (let i = 0; i < this._dynamicMagBuffer.length; i++) {
        sumSquares += this._dynamicMagBuffer[i] * this._dynamicMagBuffer[i];
      }
      const rollingRms = Math.sqrt(sumSquares / this._dynamicMagBuffer.length);
      this._vibrationRms = Number(rollingRms.toFixed(3));

      // ── Step 6: Continuous Road Quality Index ────────────────────────────
      if (rollingRms < 0.10) {
        this._roadQuality = 'smooth';
        this._roadQualityScore = Math.min(100, Math.round(90 + (0.10 - rollingRms) * 100));
      } else if (rollingRms < 0.18) {
        this._roadQuality = 'good';
        this._roadQualityScore = Math.round(72 + ((0.18 - rollingRms) / 0.08) * 18);
      } else if (rollingRms < 0.28) {
        this._roadQuality = 'moderate';
        this._roadQualityScore = Math.round(45 + ((0.28 - rollingRms) / 0.10) * 27);
      } else {
        this._roadQuality = 'rough';
        this._roadQualityScore = Math.max(10, Math.round(45 - ((rollingRms - 0.28) / 0.22) * 35));
      }

      // ── Step 7: Impact & Shock Detector (Potholes & Speed Breakers) ──────
      const shockThreshold = adaptiveShockThreshold(this._currentSpeed);
      // Peak shock energy: balances dynamic magnitude and vertical deflection
      const shockEnergy = Math.max(dynamicMag, Math.abs(verticalG));
      const isAboveShock = shockEnergy >= shockThreshold;

      if (isAboveShock) {
        if (!this._inSpike) {
          this._inSpike = true;
          this._spikeSamples = 0;
          this._spikePeakDyn = 0;
          this._spikePeakVert = 0;
          this._spikePeakRaw = totalRaw;
          this._spikePeakHoriz = horizontalG;
          this._spikeMaxJerk = jerk;
        }
        this._spikeSamples++;
        if (shockEnergy > this._spikePeakDyn) this._spikePeakDyn = shockEnergy;
        if (Math.abs(verticalG) > Math.abs(this._spikePeakVert)) this._spikePeakVert = verticalG;
        if (totalRaw > this._spikePeakRaw) this._spikePeakRaw = totalRaw;
        if (horizontalG > this._spikePeakHoriz) this._spikePeakHoriz = horizontalG;
        if (jerk > this._spikeMaxJerk) this._spikeMaxJerk = jerk;
      } else if (this._inSpike) {
        // Spike finished — evaluate it
        this._inSpike = false;
        if (
          this._spikeSamples >= MIN_SPIKE_SAMPLES &&
          this._spikeSamples <= MAX_SPIKE_SAMPLES &&
          this._spikePeakDyn > 0
        ) {
          const now = Date.now();
          if (now - this._lastBumpAt > BUMP_COOLDOWN_MS) {
            const coords = this._currentCoords;
            let tooClose = false;
            if (coords && this._lastBumpCoords) {
              const dist = haversineM(
                this._lastBumpCoords.lat,
                this._lastBumpCoords.lon,
                coords.lat,
                coords.lon,
              );
              tooClose = dist < BUMP_DEDUP_RADIUS_M;
            }

            // Exclude extreme tumbling (phone spinning wildly > 3.0 rad/s)
            const isCrazyTumble = this._angularVelocity > 3.2;

            if (!tooClose && !isCrazyTumble) {
              this._lastBumpAt = now;
              if (coords) this._lastBumpCoords = { lat: coords.lat, lon: coords.lon };

              // ── Discrimination: Pothole vs Speed Breaker ─────────────────
              // Potholes: sharp drop/impact, short duration (20-140ms = 1-7 samples), high jerk (>12 g/s)
              // Speed breakers: broad upward compression heave (160-450ms = 8+ samples), lower jerk
              const isPothole = this._spikeSamples <= 7 || this._spikeMaxJerk >= 14 || this._spikePeakVert < 0;
              const defectType: DefectType = isPothole ? 'pothole' : 'speed_breaker';

              this._onShockDetected(
                this._spikePeakDyn,
                this._spikePeakVert,
                this._spikePeakRaw,
                this._spikePeakHoriz,
                defectType,
              );
            }
          }
        }
        this._spikeSamples = 0;
        this._spikePeakDyn = 0;
        this._spikePeakVert = 0;
        this._spikePeakHoriz = 0;
        this._spikeMaxJerk = 0;
      }

      // ── Step 8: Leaky-Integrator Rough Road Patch Detector ────────────────
      // Allows realistic vibration oscillation without resetting to zero on every minor dip
      if (rollingRms >= PATCH_RMS_THRESHOLD) {
        this._patchScore = Math.min(100, this._patchScore + 3);
        this._patchSamplesInSustained++;
        this._patchRmsSum += rollingRms;
      } else {
        this._patchScore = Math.max(0, this._patchScore - 1);
        if (this._patchScore === 0) {
          this._patchSamplesInSustained = 0;
          this._patchRmsSum = 0;
        }
      }

      // If sustained rough road vibration reaches confidence threshold (> 35 points ≈ 0.8s)
      if (this._patchScore >= 35 && this._patchSamplesInSustained >= 30) {
        const now = Date.now();
        if (now - this._lastPatchAt > PATCH_COOLDOWN_MS) {
          const coords = this._currentCoords;
          let tooClose = false;
          if (coords && this._lastPatchCoords) {
            const dist = haversineM(
              this._lastPatchCoords.lat,
              this._lastPatchCoords.lon,
              coords.lat,
              coords.lon,
            );
            tooClose = dist < PATCH_DEDUP_RADIUS_M;
          }

          if (!tooClose) {
            this._lastPatchAt = now;
            if (coords) this._lastPatchCoords = { lat: coords.lat, lon: coords.lon };
            const avgRms = Number((this._patchRmsSum / this._patchSamplesInSustained).toFixed(3));
            const durationSec = Number(((this._patchSamplesInSustained * SAMPLING_INTERVAL_MS) / 1000).toFixed(1));
            this._onPatchDetected(avgRms, durationSec);
            // Reset score after logging to avoid re-triggering immediately
            this._patchScore = 15;
            this._patchSamplesInSustained = 0;
            this._patchRmsSum = 0;
          }
        }
      }
    });
  }

  // ── Event Handlers ────────────────────────────────------------------------

  private async _onShockDetected(
    peakDyn: number,
    peakVert: number,
    peakRaw: number,
    peakHoriz: number,
    defectType: DefectType,
  ): Promise<void> {
    if (!this._isRecording || !this._currentTrip) return;

    try {
      if (defectType === 'pothole') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}

    this._shockCount += 1;
    if (defectType === 'pothole') {
      this._potholeCount += 1;
    } else {
      this._speedBreakerCount += 1;
    }
    this._eventCount += 1;
    this._currentTrip.events = this._eventCount;
    this._currentTrip.eventCount = this._eventCount;

    // Speed-normalized kinetic scaling to estimate physical depth/bump height
    const effectiveSpeed = this._currentSpeed <= 0 ? 30 : this._currentSpeed;
    const speedFactor = Math.sqrt(effectiveSpeed / 35);
    const normalizedImpact = peakDyn / Math.max(0.65, speedFactor);
    const estimatedDepthCm = Number(Math.max(2.0, normalizedImpact * 4.2).toFixed(1));

    const baseThresh = adaptiveShockThreshold(this._currentSpeed);
    const relativeSpike = peakDyn / baseThresh;
    const severity: 'low' | 'medium' | 'high' =
      relativeSpike > 1.6 ? 'high' : relativeSpike > 1.2 ? 'medium' : 'low';

    const coords = this._currentCoords ?? { lat: 18.9388, lon: 72.8354 };

    const jolt: JoltEvent = {
      id: `jolt-${Date.now()}`,
      timestamp: Date.now(),
      lat: coords.lat,
      lon: coords.lon,
      speedKmh: this._currentSpeed,
      magnitude: Number(peakDyn.toFixed(2)),
      verticalG: Number(peakVert.toFixed(2)),
      horizontalG: Number(peakHoriz.toFixed(2)),
      totalG: Number(peakRaw.toFixed(2)),
      defectType,
      estimatedDepthCm,
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
        candidate_type: defectType === 'pothole' ? 'pothole' : 'speed_breaker',
        severity,
        metrics: {
          peak_dynamic: peakDyn,
          peak_vertical: peakVert,
          peak_horizontal: peakHoriz,
          peak_raw: peakRaw,
          estimated_depth_cm: estimatedDepthCm,
          vibration_rms: this._vibrationRms,
        },
      },
    }).catch(() => {});

    // Event is published via _lastJolt to sensorFusionService, which creates
    // the single unified hazard (dual-confirmed with camera or vibration-only)
    this._notifyListeners();
  }

  private async _onPatchDetected(avgRms: number, durationSec: number): Promise<void> {
    if (!this._isRecording || !this._currentTrip) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    this._patchCount += 1;
    this._eventCount += 1;
    this._currentTrip.events = this._eventCount;
    this._currentTrip.eventCount = this._eventCount;

    const severity: 'low' | 'medium' | 'high' =
      avgRms > 0.30 ? 'high' : avgRms > 0.22 ? 'medium' : 'low';

    const coords = this._currentCoords ?? { lat: 18.9388, lon: 72.8354 };

    const patch: PatchEvent = {
      id: `patch-${Date.now()}`,
      timestamp: Date.now(),
      lat: coords.lat,
      lon: coords.lon,
      speedKmh: this._currentSpeed,
      avgRms: Number(avgRms.toFixed(3)),
      durationSec,
      severity,
    };
    this._lastPatch = patch;

    // Queue rough patch event for upload
    storage.addToQueue({
      id: `upload-patch-${patch.id}`,
      type: 'event',
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      payload: {
        event_id: patch.id,
        trip_id: this._currentTrip.id,
        ts: patch.timestamp,
        lat: patch.lat,
        lon: patch.lon,
        speed_mps: this._currentSpeed / 3.6,
        source: 'auto',
        candidate_type: 'rough_patch',
        severity,
        metrics: {
          avg_rms: avgRms,
          duration_sec: durationSec,
        },
      },
    }).catch(() => {});

    // Rough patch event is published via _lastPatch to sensorFusionService,
    // which unifies it with camera texture candidates or records single patch hazard
    this._notifyListeners();
  }
}

export const tripRecorderService = new TripRecorderService();
