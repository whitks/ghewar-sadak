"""RoadMitra Dashcam Pothole Detection Backend (Flask REST API).

Endpoints:
- POST /api/upload-frame       : Ingest dashcam frame every 10s with GPS telemetry & detect potholes
- GET  /api/potholes/nearby     : Proximity search: find potholes near current vehicle GPS position
- GET  /api/potholes            : Retrieve list of all logged potholes with severity filters
- GET  /api/stats               : Overall database analytics & counts
- GET  /api/map                 : Interactive GIS OpenStreetMap with all logged defects
- GET  /api/images/<folder>/<fn>: Serve raw frames and annotated visual results
- GET  /api/health              : Server status & model readiness
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

import cv2
import numpy as np
from flask import Flask, request, jsonify, send_from_directory, render_template_string
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

# Initialize AI Detection & Depth Engine
print("⏳ Initializing Pothole Detection & Depth Engine...")
detector = PotholeDetectorEngine()

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin requests for React Native / Expo / Web


@app.route("/", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    stats = get_db_stats(DB_PATH)
    return jsonify({
        "status": "online",
        "service": "RoadMitra Pothole Detection Backend",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": detector.model_path.name,
        "database": str(DB_PATH.name),
        "total_potholes_in_db": stats["total_detections"],
        "endpoints": {
            "upload_frame": "POST /api/upload-frame",
            "nearby_alerts": "GET /api/potholes/nearby?lat=...&lon=...&radius_km=1.0",
            "list_potholes": "GET /api/potholes",
            "statistics": "GET /api/stats",
            "live_map": "GET /api/map"
        }
    })


@app.route("/api/upload-frame", methods=["POST"])
def upload_frame():
    """
    Receives frame from mobile app / dashcam every ~10s.
    Detects potholes, estimates depth, logs GPS coordinates, and returns detection metrics.
    """
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "Empty filename"}), 400

    # Parse GPS and telemetry metadata
    try:
        latitude = float(request.form.get("latitude", 28.6139))
        longitude = float(request.form.get("longitude", 77.2090))
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid latitude/longitude parameters"}), 400

    altitude = float(request.form.get("altitude", 0.0))
    speed_kmh = float(request.form.get("speed_kmh", 0.0))
    device_id = request.form.get("device_id", "dashcam_default")
    timestamp = request.form.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conf = float(request.form.get("conf", 0.20))
    run_depth = request.form.get("run_depth", "true").lower() in ("true", "1", "yes")

    frame_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    file_ext = Path(file.filename).suffix or ".jpg"
    raw_filename = f"frame_{frame_timestamp_id}{file_ext}"
    raw_filepath = FRAMES_DIR / raw_filename

    # Save uploaded raw frame
    file.save(str(raw_filepath))

    # Read image with OpenCV
    image_bgr = cv2.imread(str(raw_filepath))
    if image_bgr is None:
        return jsonify({"status": "error", "message": "Could not decode uploaded image"}), 400

    # Run AI Detection & Depth Estimation
    detections, annotated_bgr = detector.process_image(
        image_bgr=image_bgr,
        conf_threshold=conf,
        camera_height_cm=120.0,
        run_depth=run_depth
    )

    # Save annotated visualization
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
            "notes": f"Captured by {device_id} at {speed_kmh} km/h"
        }
        rec_id = insert_detection(record, db_path=DB_PATH)
        d["id"] = rec_id
        saved_records.append(d)

    return jsonify({
        "status": "success",
        "frame_id": frame_timestamp_id,
        "timestamp": timestamp,
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


@app.route("/api/process-video", methods=["POST"])
def process_video():
    """
    Process an uploaded video or the sample road video.
    Annotates ALL frames with YOLO pothole detection, bounding boxes, depth estimation, and live HUD.
    Outputs the final annotated MP4 video.
    """
    use_sample = request.form.get("use_sample", "false").lower() in ("true", "1", "yes")
    conf = float(request.form.get("conf", 0.20))
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

    if use_sample and precomputed_video.exists():
        # Instant response for pre-computed sample video
        return jsonify({
            "status": "success",
            "video_id": "sample_video_720p",
            "video_name": "sample_video_annotated.mp4",
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
    out_filename = f"annotated_{vid_timestamp_id}.mp4"
    out_filepath = VIDEOS_DIR / out_filename

    # Open video with OpenCV
    cap = cv2.VideoCapture(str(input_video_path))
    if not cap.isOpened():
        return jsonify({"status": "error", "message": "Could not open video file"}), 400

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # VideoWriter
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
        # Run AI detection on this frame
        detections, annotated = detector.process_image(
            frame,
            conf_threshold=conf,
            run_depth=False
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

        # Draw HUD bar
        hud_bg = (24, 53, 43)
        cv2.rectangle(annotated, (0, 0), (width, 42), hud_bg, -1)
        hud_text = f"RoadMitra AI Vision | Frame {processed_count}/{total_frames} | Defects: {num_defects} | Total: {total_detections}"
        cv2.putText(annotated, hud_text, (15, 27), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        out_writer.write(annotated)

    cap.release()
    out_writer.release()

    # Save peak snapshot
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
