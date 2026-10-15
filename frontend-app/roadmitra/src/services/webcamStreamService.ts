import { uploadDashcamFrame, GpsCoordinates, PotholeDetection } from './api';
import { sensorFusionService, VisualCandidate } from './sensorFusionService';
import { tripRecorderService } from './tripRecorder';

// ---------------------------------------------------------------------------
// Webcam & Dashcam Stream Types
// ---------------------------------------------------------------------------

export type CameraSourceMode = 'phone_camera' | 'wifi_dashcam' | 'ip_stream' | 'simulation';

export interface DashcamPreset {
  id: string;
  name: string;
  defaultIP: string;
  snapshotPath: string;
  streamPath: string;
  description: string;
}

export const POPULAR_DASHCAM_PRESETS: DashcamPreset[] = [
  {
    id: '70mai',
    name: '70mai Smart Dashcam',
    defaultIP: '192.168.1.1',
    snapshotPath: '/cgi-bin/snapshot.cgi',
    streamPath: 'rtsp://192.168.1.1:554/live',
    description: 'Default Wi-Fi IP for 70mai A500, A800, Dash Cam Pro',
  },
  {
    id: 'viofo',
    name: 'Viofo Dashcam (A119 / A129)',
    defaultIP: '192.168.1.254',
    snapshotPath: '/?action=snapshot',
    streamPath: 'http://192.168.1.254:8080/?action=stream',
    description: 'Standard Viofo Wi-Fi network stream',
  },
  {
    id: 'ddpai',
    name: 'DDPAI Mini / Mola',
    defaultIP: '192.168.0.1',
    snapshotPath: '/snapshot.jpg',
    streamPath: 'rtsp://192.168.0.1:554/live',
    description: 'DDPAI Wi-Fi direct connection',
  },
  {
    id: 'ip_phone',
    name: 'Spare Phone (IP Webcam App)',
    defaultIP: '192.168.43.1:8080',
    snapshotPath: '/shot.jpg',
    streamPath: 'http://192.168.43.1:8080/video',
    description: 'Old phone mounted on windshield running IP Webcam server',
  },
  {
    id: 'generic',
    name: 'Generic Car Wi-Fi Dashcam',
    defaultIP: '192.168.42.1',
    snapshotPath: '/snapshot.jpg',
    streamPath: 'http://192.168.42.1:8080/mjpeg',
    description: 'Universal Ambarella / Novatek chipset dashcam stream',
  },
];

export interface WebcamServiceState {
  sourceMode: CameraSourceMode;
  isConnected: boolean;
  activePresetId: string;
  cameraIP: string;
  streamUrl: string;
  isStreaming: boolean;
  isProcessingFrame: boolean;
  lastProcessedAt: number;
  totalFramesProcessed: number;
  totalDefectsFound: number;
  recentVisualCandidates: VisualCandidate[];
  latestDetections: PotholeDetection[];
  latestFrameUri: string | null;
  latestAnnotatedUrl: string | null;
  lastError: string | null;
}

export type WebcamServiceListener = (state: WebcamServiceState) => void;

// Built-in road footage frames for zero-hardware testing
const SIMULATION_ROAD_FRAMES = [
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=800&auto=format&fit=crop&q=80',
];

// ---------------------------------------------------------------------------
// WebcamStreamService
// ---------------------------------------------------------------------------

class WebcamStreamService {
  private _state: WebcamServiceState = {
    sourceMode: 'phone_camera',
    isConnected: true,
    activePresetId: '70mai',
    cameraIP: '192.168.1.1',
    streamUrl: 'http://192.168.1.1/cgi-bin/snapshot.cgi',
    isStreaming: false,
    isProcessingFrame: false,
    lastProcessedAt: 0,
    totalFramesProcessed: 0,
    totalDefectsFound: 0,
    recentVisualCandidates: [],
    latestDetections: [],
    latestFrameUri: null,
    latestAnnotatedUrl: null,
    lastError: null,
  };

  private _listeners: Set<WebcamServiceListener> = new Set();
  private _streamInterval: ReturnType<typeof setInterval> | null = null;
  private _simFrameIndex = 0;

  subscribe(listener: WebcamServiceListener): () => void {
    this._listeners.add(listener);
    listener(this.getState());
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify() {
    const s = this.getState();
    for (const l of this._listeners) {
      l(s);
    }
  }

  getState(): WebcamServiceState {
    return { ...this._state, recentVisualCandidates: [...this._state.recentVisualCandidates] };
  }

  // -------------------------------------------------------------------------
  // Source Selection & Configuration
  // -------------------------------------------------------------------------

  setSourceMode(mode: CameraSourceMode) {
    this._state.sourceMode = mode;
    this._state.lastError = null;
    if (mode === 'phone_camera') {
      this._state.isConnected = true;
    }
    this._notify();
  }

  selectPreset(presetId: string) {
    const preset = POPULAR_DASHCAM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    this._state.activePresetId = preset.id;
    this._state.cameraIP = preset.defaultIP;
    this._state.streamUrl = `http://${preset.defaultIP}${preset.snapshotPath}`;
    this._state.lastError = null;
    this._notify();
  }

  setCustomStreamUrl(url: string) {
    this._state.sourceMode = 'ip_stream';
    this._state.streamUrl = url;
    this._state.lastError = null;
    this._notify();
  }

  // -------------------------------------------------------------------------
  // Stream Ingestion Lifecycle
  // -------------------------------------------------------------------------

  startStream(intervalMs: number = 1400) {
    if (this._state.isStreaming) return;

    this._state.isStreaming = true;
    this._notify();

    // Process frames periodically
    this._streamInterval = setInterval(() => {
      this._processNextFrame();
    }, intervalMs);
  }

  stopStream() {
    if (this._streamInterval) {
      clearInterval(this._streamInterval);
      this._streamInterval = null;
    }
    this._state.isStreaming = false;
    this._state.isProcessingFrame = false;
    this._notify();
  }

  /**
   * Called directly by CameraView in phone_camera mode when a frame picture is taken
   */
  async processCapturedPhoneFrame(photoUri: string): Promise<VisualCandidate[]> {
    if (this._state.isProcessingFrame) {
      return [];
    }
    return await this._evaluateFrameUri(photoUri);
  }

  /**
   * Internal loop: grabs snapshot from Wi-Fi dashcam / IP camera or simulation
   */
  private async _processNextFrame() {
    if (this._state.isProcessingFrame) return;

    let frameUri: string | null = null;

    if (this._state.sourceMode === 'simulation') {
      frameUri = SIMULATION_ROAD_FRAMES[this._simFrameIndex % SIMULATION_ROAD_FRAMES.length];
      this._simFrameIndex++;
    } else if (this._state.sourceMode === 'wifi_dashcam' || this._state.sourceMode === 'ip_stream') {
      // Connect to Wi-Fi Dashcam snapshot URL
      frameUri = this._state.streamUrl;
    } else {
      // phone_camera mode frames are triggered by CameraView component
      return;
    }

    if (frameUri) {
      await this._evaluateFrameUri(frameUri);
    }
  }

  private async _evaluateFrameUri(frameUri: string): Promise<VisualCandidate[]> {
    if (this._state.isProcessingFrame) return [];
    this._state.isProcessingFrame = true;
    this._notify();

    try {
      // Fetch live GPS and speed from tripRecorderService
      const telemetry = tripRecorderService.getTelemetry();
      const gps: GpsCoordinates = {
        latitude: telemetry.coords?.lat ?? 18.9388,
        longitude: telemetry.coords?.lon ?? 72.8354,
        speed: telemetry.currentSpeed,
      };

      // Call our backend AI Model (/api/upload-frame)
      let detections: PotholeDetection[] = [];

      try {
        const response = await uploadDashcamFrame(frameUri, gps, 'dashcam_live');
        if (response && response.status === 'success') {
          detections = response.detections || [];
          this._state.latestAnnotatedUrl = response.annotated_image_url || null;
          this._state.lastError = null;

          // Save annotated scan into current active drive
          tripRecorderService.addTripImage({
            id: response.frame_id || `img-${Date.now()}`,
            uri: response.annotated_image_url || frameUri,
            rawUri: frameUri,
            timestamp: Date.now(),
            potholesFound: response.potholes_found ?? detections.length,
            defects: detections.map((d) => d.class_name),
            maxDepthCm: detections.length > 0 ? Math.max(...detections.map((d) => d.estimated_depth_cm)) : undefined,
            severity: detections.length > 0 ? (detections[0].severity as any) : undefined,
            lat: gps.latitude,
            lon: gps.longitude,
          });
        } else if (response && response.error) {
          this._state.lastError = response.error;
          detections = [];
        }
      } catch (err: any) {
        this._state.lastError = err?.message || 'Backend upload error';
        detections = [];
      }

      this._state.totalFramesProcessed++;
      this._state.lastProcessedAt = Date.now();
      this._state.latestDetections = detections;
      this._state.latestFrameUri = frameUri;

      const registeredCandidates: VisualCandidate[] = [];

      for (const d of detections) {
        this._state.totalDefectsFound++;
        const candidate = sensorFusionService.registerVisualDetection(d, frameUri, gps);
        registeredCandidates.push(candidate);
      }

      if (registeredCandidates.length > 0) {
        this._state.recentVisualCandidates = [
          ...registeredCandidates,
          ...this._state.recentVisualCandidates,
        ].slice(0, 15);
      }

      this._state.lastError = null;
      return registeredCandidates;
    } catch (err: any) {
      this._state.lastError = err?.message || 'Frame processing error';
      return [];
    } finally {
      this._state.isProcessingFrame = false;
      this._notify();
    }
  }

  /**
   * Test ping Wi-Fi Dashcam IP connection
   */
  async testConnection(ipOrUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const targetUrl = ipOrUrl.startsWith('http') ? ipOrUrl : `http://${ipOrUrl}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok || res.status === 401 || res.status === 403) {
        this._state.isConnected = true;
        this._state.lastError = null;
        this._notify();
        return { success: true, message: `Connected to Dashcam (${res.status})` };
      }
      return { success: false, message: `Dashcam responded with HTTP ${res.status}` };
    } catch (err: any) {
      return {
        success: false,
        message: 'Could not reach Dashcam Wi-Fi. Verify your phone is connected to the Dashcam Wi-Fi network.',
      };
    }
  }
}

export const webcamStreamService = new WebcamStreamService();
