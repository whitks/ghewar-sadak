"""FastAPI Backend for RoadMitra Dashcam Pothole Detection System.

Handles:
- Ingestion of dashcam frames sent from the mobile app every 10 seconds
- Object detection & 3D monocular depth estimation
- Logging to SQLite with GPS coordinates & timestamps
- Proximity search: find potholes near current GPS position (driver alert)
- Live interactive GIS map & statistics dashboard
"""

import os
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from database import init_db, insert_detection, get_all_potholes, get_nearby_potholes, get_db_stats, DB_PATH
from detector import PotholeDetectorEngine

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
FRAMES_DIR = UPLOAD_DIR / "frames"
ANNOTATED_DIR = UPLOAD_DIR / "annotated"

FRAMES_DIR.mkdir(parents=True, exist_ok=True)
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)

# Initialize database
init_db(DB_PATH)

# Initialize AI Detector
detector = PotholeDetectorEngine()

# Initialize FastAPI app
app = FastAPI(
    title="RoadMitra Pothole Detection Backend API",
    description="Backend service for receiving dashcam frames, detecting potholes, estimating depth, and logging GPS data.",
    version="1.0.0"
)

# Enable CORS for React Native / Expo / Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def health_check():
    """Server health status and API overview."""
    stats = get_db_stats(DB_PATH)
    return {
        "status": "online",
        "service": "RoadMitra Pothole Detection Backend",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": detector.model_path.name,
        "database": str(DB_PATH.name),
        "total_potholes_in_db": stats["total_detections"],
        "docs_url": "/docs"
    }


@app.post("/api/upload-frame", tags=["Detection Pipeline"])
async def upload_frame(
    file: UploadFile = File(..., description="JPEG/PNG frame captured from dashcam"),
    latitude: float = Form(..., description="GPS Latitude"),
    longitude: float = Form(..., description="GPS Longitude"),
    altitude: Optional[float] = Form(0.0, description="GPS Altitude in meters"),
    speed_kmh: Optional[float] = Form(0.0, description="Vehicle speed in km/h"),
    device_id: Optional[str] = Form("dashcam_default", description="Identifier of the mobile device or dashcam"),
    timestamp: Optional[str] = Form(None, description="ISO timestamp of frame capture"),
    conf: Optional[float] = Form(0.20, description="YOLO detection confidence threshold"),
    run_depth: Optional[bool] = Form(True, description="Enable Depth Anything V2 monocular depth estimation")
):
    """
    Receives a road frame from the mobile app / dashcam every ~10s.
    Detects potholes, estimates depth in cm, logs to database with GPS coordinates,
    and returns detection metrics.
    """
    if not timestamp:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    frame_timestamp_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    file_ext = Path(file.filename).suffix or ".jpg"
    raw_filename = f"frame_{frame_timestamp_id}{file_ext}"
    raw_filepath = FRAMES_DIR / raw_filename

    # Save uploaded frame
    contents = await file.read()
    with open(raw_filepath, "wb") as f:
        f.write(contents)

    # Decode image with OpenCV
    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file format")

    # Run AI Detection & Depth Estimation
    detections, annotated_bgr = detector.process_image(
        image_bgr=image_bgr,
        conf_threshold=conf,
        camera_height_cm=120.0,
        run_depth=run_depth
    )

    # Save annotated image
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

    return {
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
    }


@app.get("/api/potholes/nearby", tags=["GPS Driver Alerts"])
def get_nearby(
    lat: float = Query(..., description="Current vehicle GPS Latitude"),
    lon: float = Query(..., description="Current vehicle GPS Longitude"),
    radius_km: float = Query(1.0, description="Alert radius in kilometers (default: 1.0 km)"),
    limit: int = Query(50, description="Max potholes to return")
):
    """
    Returns potholes located within `radius_km` of the driver's current GPS position.
    Sorted by distance (meters) nearest first. Ideal for real-time proximity alerts.
    """
    potholes = get_nearby_potholes(lat=lat, lon=lon, radius_km=radius_km, limit=limit, db_path=DB_PATH)
    return {
        "current_position": {"latitude": lat, "longitude": lon},
        "search_radius_km": radius_km,
        "total_nearby": len(potholes),
        "potholes": potholes
    }


@app.get("/api/potholes", tags=["Data Retrieval"])
def list_potholes(
    limit: int = Query(50, description="Number of records to return"),
    offset: int = Query(0, description="Pagination offset"),
    severity: Optional[str] = Query(None, description="Filter by severity: Low, Moderate, High, Critical")
):
    """List all detected potholes recorded in the database."""
    potholes = get_all_potholes(limit=limit, offset=offset, severity=severity, db_path=DB_PATH)
    return {
        "count": len(potholes),
        "limit": limit,
        "offset": offset,
        "severity_filter": severity,
        "data": potholes
    }


@app.get("/api/stats", tags=["Dashboard"])
def get_stats():
    """Overall statistics of road defects logged in the database."""
    return get_db_stats(DB_PATH)


@app.get("/api/images/{folder}/{filename}", tags=["Image Assets"])
def get_image(folder: str, filename: str):
    """Serve uploaded frame images and annotated visual results."""
    if folder not in ["frames", "annotated"]:
        raise HTTPException(status_code=400, detail="Invalid folder")
    filepath = UPLOAD_DIR / folder / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)


@app.get("/api/map", tags=["GIS Visualization"], response_class=HTMLResponse)
def get_gis_map():
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
    return HTMLResponse(content=content)
