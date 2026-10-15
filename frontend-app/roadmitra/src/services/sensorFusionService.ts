import { Hazard } from './mockData';
import { storage } from './storage';
import { PotholeDetection } from './api';
import { tripRecorderService, JoltEvent, PatchEvent } from './tripRecorder';

// ---------------------------------------------------------------------------
// Sensor Fusion Types & Constants
// ---------------------------------------------------------------------------

export type HazardSourceType = 'camera' | 'phone' | 'both';

export interface VisualCandidate {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  speedKmh: number;
  className: string;
  defectType: 'pothole' | 'rough_patch' | 'speed_breaker';
  confidence: number; // 0.0 - 1.0 from Vision model
  estimatedDepthCm: number;
  distanceAheadM: number;
  expectedImpactTimestamp: number;
  photoUri?: string;
  bbox?: [number, number, number, number];
  matched: boolean;
}

export interface FusedEvent {
  id: string;
  timestamp: number;
  lat: number;
  lon: number;
  type: 'pothole' | 'rough_patch' | 'speed_breaker';
  source: HazardSourceType;
  fusedConfidence: number; // 0.0 - 1.0 (combined probability)
  cameraConfidence: number;
  phoneConfidence: number;
  estimatedDepthCm: number;
  peakG: number;
  speedKmh: number;
  description: string;
  photoUri?: string;
}

export type FusionListener = (event: FusedEvent) => void;

/** Max GPS distance (metres) between visual candidate and vehicle impact location */
const FUSION_MAX_DISTANCE_M = 15;

/** Time window tolerance (ms) around predicted wheel impact timestamp */
const FUSION_TIME_WINDOW_MS = 1400;

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

// ---------------------------------------------------------------------------
// SensorFusionService
// ---------------------------------------------------------------------------

class SensorFusionService {
  private _visualCandidates: VisualCandidate[] = [];
  private _fusedEvents: FusedEvent[] = [];
  private _listeners: Set<FusionListener> = new Set();
  private _unsubscribeTripTelemetry: (() => void) | null = null;
  private _lastProcessedJoltId: string | null = null;
  private _lastProcessedPatchId: string | null = null;

  constructor() {
    this._initTripListener();
  }

  private _initTripListener() {
    // Listen to real-time IMU shocks and road patches from tripRecorderService
    this._unsubscribeTripTelemetry = tripRecorderService.subscribe((telemetry) => {
      if (telemetry.lastJolt && telemetry.lastJolt.id !== this._lastProcessedJoltId) {
        this._lastProcessedJoltId = telemetry.lastJolt.id;
        this.onPhysicalShockDetected(telemetry.lastJolt);
      }

      if (telemetry.lastPatch && telemetry.lastPatch.id !== this._lastProcessedPatchId) {
        this._lastProcessedPatchId = telemetry.lastPatch.id;
        this.onPhysicalPatchDetected(telemetry.lastPatch);
      }
    });
  }

  subscribe(listener: FusionListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(event: FusedEvent) {
    for (const listener of this._listeners) {
      listener(event);
    }
  }

  getLatestFusedEvent(): FusedEvent | null {
    return this._fusedEvents[0] ?? null;
  }

  getRecentEvents(): FusedEvent[] {
    return [...this._fusedEvents];
  }

  // -------------------------------------------------------------------------
  // 1. Vision Detection Ingestion
  // -------------------------------------------------------------------------

  /**
   * Called whenever the camera / webcam vision model detects road defects ahead
   */
  registerVisualDetection(
    detection: PotholeDetection,
    photoUri: string,
    gps: { latitude: number; longitude: number; speed?: number },
  ): VisualCandidate {
    const now = Date.now();
    const isStationary = !gps.speed || gps.speed <= 10;
    const speedKmh = isStationary ? 25 : gps.speed!;
    const speedMps = speedKmh / 3.6;

    // Estimate distance ahead from depth/bbox or default ~5.5m ahead of bumper
    const distanceAheadM = detection.distance_meters ?? 5.5;

    // Time to impact: Δt = d / v (for stationary, expected impact is immediate / current window)
    const timeToImpactMs = isStationary ? 0 : (distanceAheadM / speedMps) * 1000;
    const expectedImpactTimestamp = isStationary ? now : now + Math.round(timeToImpactMs);

    const cName = detection.class_name.toLowerCase();
    const defectType: 'pothole' | 'rough_patch' | 'speed_breaker' =
      cName.includes('speed') ? 'speed_breaker'
      : cName.includes('patch') || cName.includes('alligator') || cName.includes('crack') ? 'rough_patch'
      : 'pothole';

    const candidate: VisualCandidate = {
      id: `vis-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      lat: gps.latitude,
      lon: gps.longitude,
      speedKmh,
      className: detection.class_name,
      defectType,
      confidence: detection.confidence,
      estimatedDepthCm: detection.estimated_depth_cm ?? 4.0,
      distanceAheadM,
      expectedImpactTimestamp,
      photoUri,
      bbox: detection.bbox,
      matched: false,
    };

    this._visualCandidates.push(candidate);

    // Prune stale visual candidates older than 10 seconds
    const pruneCutoff = now - 10000;
    this._visualCandidates = this._visualCandidates.filter((c) => c.timestamp >= pruneCutoff);

    // Schedule unmatched fallback check: If vehicle passed or driver avoided,
    // record as visual-only detection so it's not lost
    const gracePeriodMs = isStationary ? 6000 : Math.max(3500, timeToImpactMs + 1800);
    setTimeout(() => {
      this._checkUnmatchedVisualCandidate(candidate.id);
    }, gracePeriodMs);

    return candidate;
  }

  // -------------------------------------------------------------------------
  // 2. Physical Shock & Vibration Ingestion + Real-time Fusion
  // -------------------------------------------------------------------------

  /**
   * Called when phone's 50 Hz accelerometer detects a shock (pothole or speed breaker)
   */
  private onPhysicalShockDetected(jolt: JoltEvent) {
    const now = Date.now();
    let bestMatch: VisualCandidate | null = null;
    let minTimeDiff = Infinity;
    const isStationary = jolt.speedKmh <= 10;

    // Search active visual candidates for spatial & temporal alignment
    for (const cand of this._visualCandidates) {
      if (cand.matched) continue;

      if (isStationary) {
        // When stationary or testing: match with any active visual detection within last 10 seconds!
        if (now - cand.timestamp <= 10000) {
          bestMatch = cand;
          break;
        }
      } else {
        const timeDiff = Math.abs(now - cand.expectedImpactTimestamp);
        if (timeDiff <= 2500) {
          const dist = haversineM(cand.lat, cand.lon, jolt.lat, jolt.lon);
          if (dist <= 25 && timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            bestMatch = cand;
          }
        }
      }
    }

    if (bestMatch) {
      // ── DUAL FUSION CONFIRMED! Camera saw it + Phone felt it ──────────────
      bestMatch.matched = true;

      // Combined Bayesian Confidence: P = 1 - (1 - P_cam) * (1 - P_imu)
      const camConf = bestMatch.confidence;
      const phoneConf = Math.min(0.95, 0.50 + jolt.magnitude * 0.35);
      const fusedConfidence = Number(
        Math.min(0.99, 1 - (1 - camConf) * (1 - phoneConf)).toFixed(2),
      );

      const fusedEvent: FusedEvent = {
        id: `fused-${now}`,
        timestamp: now,
        lat: jolt.lat,
        lon: jolt.lon,
        type: jolt.defectType,
        source: 'both',
        fusedConfidence,
        cameraConfidence: Number(camConf.toFixed(2)),
        phoneConfidence: Number(phoneConf.toFixed(2)),
        estimatedDepthCm: Number(((bestMatch.estimatedDepthCm + jolt.estimatedDepthCm) / 2).toFixed(1)),
        peakG: jolt.magnitude,
        speedKmh: jolt.speedKmh,
        description: `Dual-Confirmed ${jolt.defectType.toUpperCase()}: ${bestMatch.estimatedDepthCm}cm visually + ${jolt.magnitude}G shock`,
        photoUri: bestMatch.photoUri,
      };

      this._saveFusedHazard(fusedEvent);
      this._notify(fusedEvent);
    } else {
      // Vibration-only detection (no camera match)
      const phoneConf = Math.min(0.95, 0.50 + jolt.magnitude * 0.35);
      const fusedEvent: FusedEvent = {
        id: `shock-${jolt.id}`,
        timestamp: now,
        lat: jolt.lat,
        lon: jolt.lon,
        type: jolt.defectType,
        source: 'phone',
        fusedConfidence: Number(phoneConf.toFixed(2)),
        cameraConfidence: 0.0,
        phoneConfidence: Number(phoneConf.toFixed(2)),
        estimatedDepthCm: jolt.estimatedDepthCm,
        peakG: jolt.magnitude,
        speedKmh: jolt.speedKmh,
        description: `Vibration ${jolt.defectType.toUpperCase()}: ${jolt.magnitude}G shock (~${jolt.estimatedDepthCm}cm depth)`,
      };

      this._saveFusedHazard(fusedEvent);
      this._notify(fusedEvent);
    }
  }

  /**
   * Called when phone's accelerometer detects a sustained rough road patch
   */
  private onPhysicalPatchDetected(patch: PatchEvent) {
    const now = Date.now();
    let bestMatch: VisualCandidate | null = null;
    const isStationary = patch.speedKmh <= 10;

    for (const cand of this._visualCandidates) {
      if (cand.matched || cand.defectType !== 'rough_patch') continue;
      if (isStationary && now - cand.timestamp <= 10000) {
        bestMatch = cand;
        break;
      }
      const dist = haversineM(cand.lat, cand.lon, patch.lat, patch.lon);
      if (dist <= 25) {
        bestMatch = cand;
        break;
      }
    }

    if (bestMatch) {
      bestMatch.matched = true;
      const camConf = bestMatch.confidence;
      const phoneConf = Math.min(0.92, 0.50 + patch.avgRms * 1.5);
      const fusedConfidence = Number(
        Math.min(0.98, 1 - (1 - camConf) * (1 - phoneConf)).toFixed(2),
      );

      const fusedEvent: FusedEvent = {
        id: `fused-patch-${now}`,
        timestamp: now,
        lat: patch.lat,
        lon: patch.lon,
        type: 'rough_patch',
        source: 'both',
        fusedConfidence,
        cameraConfidence: Number(camConf.toFixed(2)),
        phoneConfidence: Number(phoneConf.toFixed(2)),
        estimatedDepthCm: 3.0,
        peakG: Number(patch.avgRms.toFixed(2)),
        speedKmh: patch.speedKmh,
        description: `Dual-Confirmed ROUGH PATCH: Camera texture + ${patch.avgRms}G sustained vibration (${patch.durationSec}s)`,
        photoUri: bestMatch.photoUri,
      };

      this._saveFusedHazard(fusedEvent);
      this._notify(fusedEvent);
    } else {
      const phoneConf = Math.min(0.90, 0.45 + patch.avgRms * 1.5);
      const fusedEvent: FusedEvent = {
        id: `patch-${patch.id}`,
        timestamp: now,
        lat: patch.lat,
        lon: patch.lon,
        type: 'rough_patch',
        source: 'phone',
        fusedConfidence: Number(phoneConf.toFixed(2)),
        cameraConfidence: 0.0,
        phoneConfidence: Number(phoneConf.toFixed(2)),
        estimatedDepthCm: 2.5,
        peakG: Number(patch.avgRms.toFixed(2)),
        speedKmh: patch.speedKmh,
        description: `Vibration ROUGH PATCH: ${patch.avgRms}G sustained vibration (${patch.durationSec}s)`,
      };

      this._saveFusedHazard(fusedEvent);
      this._notify(fusedEvent);
    }
  }

  /**
   * If a visual hazard was detected ahead but no wheel shock happened (e.g. driver steered around),
   * record as a camera-only detected hazard
   */
  private _checkUnmatchedVisualCandidate(candidateId: string) {
    const cand = this._visualCandidates.find((c) => c.id === candidateId);
    if (!cand || cand.matched) return;

    cand.matched = true;
    const fusedEvent: FusedEvent = {
      id: `cam-${cand.id}`,
      timestamp: cand.timestamp,
      lat: cand.lat,
      lon: cand.lon,
      type: cand.defectType,
      source: 'camera',
      fusedConfidence: Number(cand.confidence.toFixed(2)),
      cameraConfidence: Number(cand.confidence.toFixed(2)),
      phoneConfidence: 0.0,
      estimatedDepthCm: cand.estimatedDepthCm,
      peakG: 0.0,
      speedKmh: cand.speedKmh,
      description: `Camera-Detected ${cand.defectType.toUpperCase()}: ~${cand.estimatedDepthCm}cm depth (driver avoided or zero vibration)`,
      photoUri: cand.photoUri,
    };

    this._saveFusedHazard(fusedEvent);
    this._notify(fusedEvent);
  }

  private async _saveFusedHazard(event: FusedEvent) {
    this._fusedEvents.unshift(event);
    if (this._fusedEvents.length > 50) {
      this._fusedEvents.length = 50;
    }

    const severityScore = Math.min(
      100,
      Math.round(event.fusedConfidence * 70 + (event.estimatedDepthCm / 10) * 30),
    );

    const hazard: Hazard = {
      id: `haz-${event.id}`,
      lat: event.lat,
      lon: event.lon,
      type: event.type,
      status: event.source === 'both' ? 'confirmed' : 'probable',
      confidence: event.fusedConfidence,
      severity: severityScore,
      source: event.source,
      cameraScore: event.cameraConfidence > 0 ? event.cameraConfidence : undefined,
      phoneScore: event.phoneConfidence > 0 ? event.phoneConfidence : undefined,
      deviceCount: event.source === 'both' ? 2 : 1,
      lastSeen: new Date().toISOString(),
      description: event.description,
      photoUri: event.photoUri,
      magnitude: event.peakG > 0 ? event.peakG : undefined,
      speedKmh: event.speedKmh,
    };

    await storage.addHazard(hazard).catch(() => {});
  }
}

export const sensorFusionService = new SensorFusionService();
