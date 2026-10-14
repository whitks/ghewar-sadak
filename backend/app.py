"""RoadMitra Dashcam Pothole & Road Defect Detection Backend (Flask REST API).

Endpoints:
- POST /api/annotate-frame       : Real-time image annotation (returns annotated JPEG frame directly or JSON)
- POST /api/detect/image          : Alias for /api/annotate-frame
- POST /api/detect/clip           : Process video clips (returns annotated MP4 or JSON metrics)
- POST /api/process-clip          : Alias for /api/detect/clip
- POST /api/upload-frame          : Ingest dashcam frame every 10s with GPS telemetry & log to database
- POST /api/process-video         : Full video processor for long drives
- GET  /api/models                : List available models ("fast" vs "accurate" vs "yolo26")
- GET  /api/potholes/nearby       : Proximity search: find potholes near current vehicle GPS position
- GET  /api/potholes             : Retrieve list of all logged potholes with severity filters
- GET  /api/stats                : Overall database analytics & counts
- GET  /api/map                  : Interactive GIS OpenStreetMap with all logged defects
- GET  /api/images/<folder>/<fn> : Serve raw frames and annotated visual results
- GET  /api/videos/<filename>     : Serve processed and annotated MP4 video files
- GET  /api/health               : Server status & model readiness
"""

import base64
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

import cv2
import numpy as np
from flask import Flask, request, jsonify, send_from_directory, render_template_string, Response
from flask_cors import CORS

from database import init_db, insert_detection, get_all_potholes, get_nearby_potholes, get_db_stats, DB_PATH
from detector import PotholeDetectorEngine

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
FRAMES_DIR = UPLOAD_DIR / "frames"
ANNOTATED_DIR = UPLOAD_DIR / "annotated"
VIDEOS_DIR = UPLOAD_DIR / "videos"

FRAMES_DIR.mkdir(parents=True, exist_ok=True)
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

# Initialize database schema
init_db(DB_PATH)

# Initialize AI Detection & Depth Engine (preloads fast model for real-time inference)
print("⏳ Initializing RoadMitra Multi-Model AI Engine...")
detector = PotholeDetectorEngine(default_model="fast")

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin requests for React Native / Expo / Web


# ── Health & Model Overview ──────────────────────────────────────────────────

@app.route("/", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint showing server status and model readiness."""
    stats = get_db_stats(DB_PATH)
    models_info = detector.list_available_models()
    return jsonify({
        "status": "online",
        "service": "RoadMitra Pothole & Road Defect Detection Backend",
        "timestamp": datetime.now().isoformat(),
        "default_confidence_threshold": 0.15,
        "potholes_only_filter": False,
        "all_defects_tracked": True,
        "database": str(DB_PATH.name),
        "total_potholes_in_db": stats["total_detections"],
        "models": models_info,
        "endpoints": {
            "annotate_frame": "POST /api/annotate-frame (returns real-time annotated image or JSON)",
            "detect_clip": "POST /api/detect/clip (processes clips & returns annotated MP4 or stats)",
            "upload_frame": "POST /api/upload-frame (10s telemetry + SQLite logging)",
            "process_video": "POST /api/process-video (full video annotation)",
            "models_list": "GET /api/models",
            "nearby_alerts": "GET /api/potholes/nearby?lat=...&lon=...&radius_km=1.0",
            "list_potholes": "GET /api/potholes",
            "statistics": "GET /api/stats",
            "live_map": "GET /api/map"
        }
    })


@app.route("/api/models", methods=["GET"])
def list_models():
    """Returns details about available models ('fast' vs 'accurate' vs 'yolo26')."""
    return jsonify({
        "status": "success",
        "models": detector.list_available_models(),
        "notes": {
            "fast": "Lightweight model from pothole-cv-experiment (~15ms latency, best for real-time feeds)",
            "accurate": "Comprehensive model from model/ folder (Longitudinal, Transverse, Alligator Cracks, Potholes, Other)",
            "yolo26": "CRDDC challenge fine-tuned model from yolo26-experiment (84.5% pothole precision)",
            "policy": "Never filters to potholes-only; detects all road distress classes at default conf=0.15"
        }
    })


# ── Helper for Extracting Uploaded Image Bytes ────────────────────────────────

def _extract_image_bytes(req) -> Optional[bytes]:
    """Helper to extract raw image bytes from multipart, raw binary body, or JSON base64."""
    # 1. Check multipart form
    for key in ["file", "image", "frame"]:
        if key in req.files and req.files[key].filename != "":
            return req.files[key].read()

    # 2. Check JSON payload with base64
    if req.is_json:
        data = req.get_json(silent=True) or {}
        img_b64 = data.get("image") or data.get("file") or data.get("frame")
        if img_b64:
            if "," in img_b64:
                img_b64 = img_b64.split(",", 1)[1]
            try:
                return base64.b64decode(img_b64)
            except Exception:
                pass

    # 3. Check raw binary request body
    if req.data and len(req.data) > 64:
        content_type = req.headers.get("Content-Type", "")
        if "image" in content_type or "octet-stream" in content_type or req.data[:2] in [b"\xff\xd8", b"\x89P"]:
            return req.data

    # 4. Check query param to use test sample image
    if req.args.get("use_sample", "false").lower() in ("true", "1", "yes") or req.form.get("use_sample", "false").lower() in ("true", "1", "yes"):
        candidates = [
            BASE_DIR.parent / "model" / "images.jpg",
            BASE_DIR.parent / "model" / "image.png"
        ]
        for p in candidates:
            if p.exists():
                with open(p, "rb") as f:
                    return f.read()

    return None


# ── Real-Time Image / Frame Annotation Endpoint ──────────────────────────────

@app.route("/api/annotate-frame", methods=["POST"])
@app.route("/api/detect/image", methods=["POST"])
def annotate_frame():
    """
    Takes in an image frame and serves the annotated frame with bounding boxes and defect metrics.
    
    Query/Form parameters:
    - model: 'fast' (default, ~15ms) or 'accurate' (multi-class cracks+potholes+distress) or 'yolo26'
    - conf: Confidence threshold (default: 0.15)
    - run_depth: Enable 3D depth transformer (default: False for real-time speed)
    - format: 'image' (returns raw image/jpeg) or 'json' (returns detections + base64 + URLs)
    - draw_hud: Whether to draw top HUD overlay (default: True)
    - quality: JPEG compression quality 1-100 (default: 85)
    """
    img_bytes = _extract_image_bytes(request)
    if not img_bytes:
        return jsonify({
            "status": "error",
            "message": "No image provided. Upload a file ('file' or 'image'), send raw JPEG bytes in body, or JSON {'image': 'base64...'}"
        }), 400

    # Parse parameters with default conf = 0.15 (as requested)
    model_name = request.args.get("model") or request.form.get("model") or "fast"
    try:
        conf = float(request.args.get("conf") or request.form.get("conf") or 0.15)
    except (ValueError, TypeError):
        conf = 0.15

    run_depth = (request.args.get("run_depth") or request.form.get("run_depth") or "false").lower() in ("true", "1", "yes")
    draw_hud = (request.args.get("draw_hud") or request.form.get("draw_hud") or "true").lower() in ("true", "1", "yes")
    try:
        quality = int(request.args.get("quality") or request.form.get("quality") or 85)
    except (ValueError, TypeError):
        quality = 85

    # Determine desired response format: 'image' (default) vs 'json'
    requested_format = (request.args.get("format") or request.form.get("format") or "").lower()
    accept_header = request.headers.get("Accept", "")
    wants_json = requested_format == "json" or ("application/json" in accept_header and requested_format != "image")

    try:
        annotated_jpg_bytes, detections, elapsed_ms = detector.annotate_jpeg_bytes(
            image_input=img_bytes,
            model_name=model_name,
            conf_threshold=conf,
            run_depth=run_depth,
            draw_hud=draw_hud,
            jpeg_quality=quality
        )
    except Exception as e:
        return jsonify({"status": "error", "message": f"Inference failed: {str(e)}"}), 500

    model_key = detector.resolve_model_key(model_name)

    # 1. Return RAW ANNOTATED JPEG for real-time video/camera feeds
    if not wants_json:
        resp = Response(annotated_jpg_bytes, mimetype="image/jpeg")
        resp.headers["X-Detections-Count"] = str(len(detections))
        resp.headers["X-Model-Used"] = model_key
        resp.headers["X-Inference-Time-Ms"] = str(elapsed_ms)
        resp.headers["X-Confidence-Threshold"] = str(conf)
        resp.headers["Access-Control-Expose-Headers"] = "X-Detections-Count, X-Model-Used, X-Inference-Time-Ms, X-Confidence-Threshold"
        return resp

    # 2. Return JSON with detections, metrics, and base64 data URL
    frame_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    annotated_filename = f"annotated_{frame_timestamp_id}.jpg"
    annotated_filepath = ANNOTATED_DIR / annotated_filename
    with open(annotated_filepath, "wb") as f:
        f.write(annotated_jpg_bytes)

    base64_data_uri = "data:image/jpeg;base64," + base64.b64encode(annotated_jpg_bytes).decode("ascii")

    return jsonify({
        "status": "success",
        "model_used": model_key,
        "confidence_threshold": conf,
        "potholes_only_filter": False,
        "potholes_found": len(detections),
        "inference_ms": elapsed_ms,
        "fps_estimate": round(1000.0 / max(1.0, elapsed_ms), 1),
        "detections": detections,
        "annotated_image_url": f"/api/images/annotated/{annotated_filename}",
        "annotated_image_base64": base64_data_uri
    })


# ── Video Clip Processing Endpoint ───────────────────────────────────────────

@app.route("/api/detect/clip", methods=["POST"])
@app.route("/api/process-clip", methods=["POST"])
def detect_clip():
    """
    Takes a short video clip (or video file) and returns the annotated video or result metrics.
    
    Parameters:
    - video: Video file upload (multipart)
    - model: 'fast' (default) or 'accurate' or 'yolo26'
    - conf: Confidence threshold (default: 0.15, never potholes only)
    - max_frames: Max frames to process (default: 300)
    - format: 'json' (default, returns URLs & stats) or 'video' (direct MP4 stream)
    - run_depth: Whether to compute 3D depth (default: False for high FPS)
    """
    use_sample = request.form.get("use_sample", "false").lower() in ("true", "1", "yes")
    model_name = request.form.get("model") or request.args.get("model") or "fast"
    model_key = detector.resolve_model_key(model_name)
    try:
        conf = float(request.form.get("conf") or request.args.get("conf") or 0.15)
    except (ValueError, TypeError):
        conf = 0.15

    max_frames_limit = int(request.form.get("max_frames") or request.args.get("max_frames") or 300)
    run_depth = (request.form.get("run_depth") or request.args.get("run_depth") or "false").lower() in ("true", "1", "yes")
    return_video_direct = (request.form.get("format") or request.args.get("format") or "").lower() == "video"

    sample_file_path = BASE_DIR.parent / "sample_video.mp4"
    input_video_path = None

    if "video" in request.files and request.files["video"].filename != "":
        vid_file = request.files["video"]
        vid_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = Path(vid_file.filename).suffix or ".mp4"
        input_video_path = VIDEOS_DIR / f"raw_clip_{vid_timestamp_id}{ext}"
        vid_file.save(str(input_video_path))
    elif use_sample or sample_file_path.exists():
        input_video_path = sample_file_path
    else:
        return jsonify({"status": "error", "message": "No video provided and sample_video.mp4 not found"}), 400

    vid_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_filename = f"annotated_clip_{model_key}_{vid_timestamp_id}.mp4"
    out_filepath = VIDEOS_DIR / out_filename

    cap = cv2.VideoCapture(str(input_video_path))
    if not cap.isOpened():
        return jsonify({"status": "error", "message": "Could not open video file"}), 400

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_writer = cv2.VideoWriter(str(out_filepath), fourcc, fps, (width, height))

    total_detections = 0
    frames_with_defects = 0
    peak_conf = 0.0
    max_defects_in_frame = 0
    peak_frame_bgr = None
    processed_count = 0
    t_start = time.time()

    while cap.isOpened() and (max_frames_limit <= 0 or processed_count < max_frames_limit):
        ret, frame = cap.read()
        if not ret:
            break

        processed_count += 1
        detections, annotated = detector.process_image(
            image_bgr=frame,
            model_name=model_key,
            conf_threshold=conf,
            run_depth=run_depth,
            draw_hud=True
        )

        num_defects = len(detections)
        if num_defects > 0:
            total_detections += num_defects
            frames_with_defects += 1
            if num_defects > max_defects_in_frame:
                max_defects_in_frame = num_defects
            for d in detections:
                if d["confidence"] > peak_conf:
                    peak_conf = d["confidence"]
                    peak_frame_bgr = annotated.copy()

        out_writer.write(annotated)

    cap.release()
    out_writer.release()
    total_time = round(time.time() - t_start, 2)

    # Save peak snapshot
    snapshot_filename = f"snapshot_clip_{vid_timestamp_id}.jpg"
    snapshot_filepath = ANNOTATED_DIR / snapshot_filename
    if peak_frame_bgr is not None:
        cv2.imwrite(str(snapshot_filepath), peak_frame_bgr)

    if return_video_direct:
        return send_from_directory(VIDEOS_DIR, out_filename, mimetype="video/mp4")

    return jsonify({
        "status": "success",
        "clip_id": vid_timestamp_id,
        "model_used": model_key,
        "confidence_threshold": conf,
        "potholes_only_filter": False,
        "total_frames_processed": processed_count,
        "total_frames_in_video": total_frames,
        "fps": fps,
        "duration_sec": round(processed_count / fps, 1),
        "processing_time_sec": total_time,
        "average_fps": round(processed_count / max(0.001, total_time), 1),
        "total_defects_detected": total_detections,
        "frames_with_defects": frames_with_defects,
        "peak_confidence": round(peak_conf, 3),
        "max_defects_in_frame": max_defects_in_frame,
        "annotated_video_url": f"/api/videos/{out_filename}",
        "peak_snapshot_url": f"/api/images/annotated/{snapshot_filename}" if peak_frame_bgr is not None else None
    })


# ── Full Video Processor (Drive Uploads) ─────────────────────────────────────

@app.route("/api/process-video", methods=["POST"])
def process_video():
    """
    Process an uploaded video or the sample road video.
    Annotates ALL frames with YOLO road defect detection, bounding boxes, depth estimation, and live HUD.
    Outputs the final annotated MP4 video.
    """
    use_sample = request.form.get("use_sample", "false").lower() in ("true", "1", "yes")
    model_name = request.form.get("model") or request.args.get("model") or "fast"
    model_key = detector.resolve_model_key(model_name)
    try:
        conf = float(request.form.get("conf") or 0.15)
    except (ValueError, TypeError):
        conf = 0.15

    sample_file_path = BASE_DIR.parent / "sample_video.mp4"
    precomputed_video = VIDEOS_DIR / "sample_video_annotated.mp4"
    precomputed_snapshot = ANNOTATED_DIR / "sample_video_peak_snapshot.jpg"

    # Auto-link from yolo26-experiment if not yet in uploads/videos
    if not precomputed_video.exists():
        exp_vid = BASE_DIR.parent / "yolo26-experiment" / "sample_video_detected.mp4"
        if exp_vid.exists():
            import shutil
            shutil.copyfile(str(exp_vid), str(precomputed_video))
    if not precomputed_snapshot.exists():
        exp_snap = BASE_DIR.parent / "yolo26-experiment" / "sample_video_peak_snapshot.jpg"
        if exp_snap.exists():
            import shutil
            shutil.copyfile(str(exp_snap), str(precomputed_snapshot))

    if use_sample and precomputed_video.exists() and model_key == "yolo26":
        return jsonify({
            "status": "success",
            "video_id": "sample_video_720p",
            "video_name": "sample_video_annotated.mp4",
            "model_used": "yolo26",
            "total_frames_processed": 375,
            "fps": 25.0,
            "duration_sec": 15.0,
            "total_potholes_detected": 583,
            "frames_with_potholes": 292,
            "peak_confidence": 0.831,
            "max_potholes_in_frame": 5,
            "annotated_video_url": "/api/videos/sample_video_annotated.mp4",
            "peak_snapshot_url": "/api/images/annotated/sample_video_peak_snapshot.jpg",
            "source": "precomputed_sample"
        })

    # Handle uploaded video file or fallback to sample_video.mp4
    input_video_path = None
    if "video" in request.files and request.files["video"].filename != "":
        vid_file = request.files["video"]
        vid_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = Path(vid_file.filename).suffix or ".mp4"
        input_video_path = VIDEOS_DIR / f"raw_{vid_timestamp_id}{ext}"
        vid_file.save(str(input_video_path))
    elif sample_file_path.exists():
        input_video_path = sample_file_path
    else:
        return jsonify({"status": "error", "message": "No video provided and sample_video.mp4 not found"}), 400

    vid_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_filename = f"annotated_{model_key}_{vid_timestamp_id}.mp4"
    out_filepath = VIDEOS_DIR / out_filename

    cap = cv2.VideoCapture(str(input_video_path))
    if not cap.isOpened():
        return jsonify({"status": "error", "message": "Could not open video file"}), 400

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out_writer = cv2.VideoWriter(str(out_filepath), fourcc, fps, (width, height))

    total_detections = 0
    frames_with_defects = 0
    peak_conf = 0.0
    max_potholes = 0
    peak_frame_bgr = None
    processed_count = 0
    max_frames_limit = int(request.form.get("max_frames", 400))

    while cap.isOpened() and processed_count < max_frames_limit:
        ret, frame = cap.read()
        if not ret:
            break

        processed_count += 1
        detections, annotated = detector.process_image(
            image_bgr=frame,
            model_name=model_key,
            conf_threshold=conf,
            run_depth=False,
            draw_hud=True
        )

        num_defects = len(detections)
        if num_defects > 0:
            total_detections += num_defects
            frames_with_defects += 1
            if num_defects > max_potholes:
                max_potholes = num_defects
            for d in detections:
                if d["confidence"] > peak_conf:
                    peak_conf = d["confidence"]
                    peak_frame_bgr = annotated.copy()

        out_writer.write(annotated)

    cap.release()
    out_writer.release()

    snapshot_filename = f"snapshot_{vid_timestamp_id}.jpg"
    snapshot_filepath = ANNOTATED_DIR / snapshot_filename
    if peak_frame_bgr is not None:
        cv2.imwrite(str(snapshot_filepath), peak_frame_bgr)
    elif precomputed_snapshot.exists():
        snapshot_filename = "sample_video_peak_snapshot.jpg"

    return jsonify({
        "status": "success",
        "video_id": vid_timestamp_id,
        "video_name": out_filename,
        "model_used": model_key,
        "confidence_threshold": conf,
        "potholes_only_filter": False,
        "total_frames_processed": processed_count,
        "fps": fps,
        "duration_sec": round(processed_count / fps, 1),
        "total_potholes_detected": total_detections,
        "frames_with_potholes": frames_with_defects,
        "peak_confidence": round(peak_conf, 3),
        "max_potholes_in_frame": max_potholes,
        "annotated_video_url": f"/api/videos/{out_filename}",
        "peak_snapshot_url": f"/api/images/annotated/{snapshot_filename}"
    })


# ── Dashcam Frame Upload (10-Second Telemetry Ingestion) ──────────────────────

@app.route("/api/upload-frame", methods=["POST"])
def upload_frame():
    """
    Receives frame from mobile app / dashcam every ~10s.
    Detects defects, estimates depth, logs GPS coordinates, and returns detection metrics.
    """
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "Empty filename"}), 400

    try:
        latitude = float(request.form.get("latitude", 28.6139))
        longitude = float(request.form.get("longitude", 77.2090))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid latitude/longitude parameters"}), 400

    altitude = float(request.form.get("altitude", 0.0))
    speed_kmh = float(request.form.get("speed_kmh", 0.0))
    device_id = request.form.get("device_id", "dashcam_default")
    timestamp = request.form.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    model_name = request.form.get("model", "fast")
    conf = float(request.form.get("conf", 0.15))
    run_depth = request.form.get("run_depth", "false").lower() in ("true", "1", "yes")

    frame_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    file_ext = Path(file.filename).suffix or ".jpg"
    raw_filename = f"frame_{frame_timestamp_id}{file_ext}"
    raw_filepath = FRAMES_DIR / raw_filename

    # Save uploaded raw frame
    file.save(str(raw_filepath))

    image_bgr = cv2.imread(str(raw_filepath))
    if image_bgr is None:
        return jsonify({"status": "error", "message": "Could not decode uploaded image"}), 400

    # Run AI Detection & Depth Estimation (All classes, default conf=0.15)
    detections, annotated_bgr = detector.process_image(
        image_bgr=image_bgr,
        model_name=model_name,
        conf_threshold=conf,
        camera_height_cm=120.0,
        run_depth=run_depth,
        draw_hud=True
    )

    annotated_filename = f"annotated_{frame_timestamp_id}.jpg"
    annotated_filepath = ANNOTATED_DIR / annotated_filename
    cv2.imwrite(str(annotated_filepath), annotated_bgr)

    # Log detections into SQLite database
    saved_records = []
    for d in detections:
        record = {
            "timestamp": timestamp,
            "device_id": device_id,
            "speed_kmh": speed_kmh,
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6),
            "altitude": round(altitude, 2),
            "class_name": d["class_name"],
            "confidence": d["confidence"],
            "bbox_x1": d["bbox"][0],
            "bbox_y1": d["bbox"][1],
            "bbox_x2": d["bbox"][2],
            "bbox_y2": d["bbox"][3],
            "bbox_width": d["width"],
            "bbox_height": d["height"],
            "bbox_area": d["area"],
            "estimated_depth_cm": d["estimated_depth_cm"],
            "depth_class": d["depth_class"],
            "severity": d["severity"],
            "repair_urgency": d["repair_urgency"],
            "frame_image_path": str(raw_filepath),
            "annotated_image_path": str(annotated_filepath),
            "notes": f"Captured by {device_id} at {speed_kmh} km/h [{detector.resolve_model_key(model_name)}]"
        }
        rec_id = insert_detection(record, db_path=DB_PATH)
        d["id"] = rec_id
        saved_records.append(d)

    return jsonify({
        "status": "success",
        "frame_id": frame_timestamp_id,
        "timestamp": timestamp,
        "model_used": detector.resolve_model_key(model_name),
        "confidence_threshold": conf,
        "potholes_only_filter": False,
        "gps": {
            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,
            "speed_kmh": speed_kmh
        },
        "device_id": device_id,
        "potholes_found": len(detections),
        "detections": detections,
        "annotated_image_url": f"/api/images/annotated/{annotated_filename}",
        "raw_image_url": f"/api/images/frames/{raw_filename}"
    })


# ── Query & Analytics Endpoints ──────────────────────────────────────────────

@app.route("/api/potholes/nearby", methods=["GET"])
def get_nearby():
    """Returns potholes within radius_km of vehicle position for live driver alerts."""
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Missing or invalid lat/lon parameters"}), 400

    radius_km = float(request.args.get("radius_km", 1.0))
    limit = int(request.args.get("limit", 50))

    potholes = get_nearby_potholes(lat=lat, lon=lon, radius_km=radius_km, limit=limit, db_path=DB_PATH)
    return jsonify({
        "current_position": {"latitude": lat, "longitude": lon},
        "search_radius_km": radius_km,
        "total_nearby": len(potholes),
        "potholes": potholes
    })


@app.route("/api/potholes", methods=["GET"])
def list_potholes():
    """Retrieve list of all logged potholes."""
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))
    severity = request.args.get("severity")

    potholes = get_all_potholes(limit=limit, offset=offset, severity=severity, db_path=DB_PATH)
    return jsonify({
        "count": len(potholes),
        "limit": limit,
        "offset": offset,
        "severity_filter": severity,
        "data": potholes
    })


@app.route("/api/stats", methods=["GET"])
def stats():
    """Returns aggregated road distress statistics."""
    return jsonify(get_db_stats(DB_PATH))


@app.route("/api/images/<folder>/<filename>", methods=["GET"])
def serve_image(folder: str, filename: str):
    """Serve uploaded frame images and annotated images."""
    if folder not in ["frames", "annotated"]:
        return jsonify({"status": "error", "message": "Invalid folder"}), 400
    target_dir = UPLOAD_DIR / folder
    return send_from_directory(target_dir, filename)


@app.route("/api/videos/<filename>", methods=["GET"])
def serve_video(filename: str):
    """Serve processed and annotated MP4 video files."""
    return send_from_directory(VIDEOS_DIR, filename, mimetype="video/mp4")


@app.route("/api/map", methods=["GET"])
def live_map():
    """Serves the interactive Leaflet GIS map with all recorded potholes."""
    records = get_all_potholes(limit=500, db_path=DB_PATH)

    import sys
    ROOT_DIR = BASE_DIR.parent
    sys.path.insert(0, str(ROOT_DIR / "model"))
    sys.path.insert(0, str(ROOT_DIR))
    from map_generator import generate_map_html

    map_path = BASE_DIR / "potholes_map.html"
    generate_map_html(records, output_path=map_path)

    with open(map_path, "r", encoding="utf-8") as f:
        content = f.read()
    return render_template_string(content)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 RoadMitra Backend Server starting on http://0.0.0.0:{port} ...")
    app.run(host="0.0.0.0", port=port, debug=False)
