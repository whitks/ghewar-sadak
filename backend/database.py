"""SQLite Database Module for Pothole Detection Backend.

Stores:
- Detection events with GPS coordinates (lat, lon, altitude, speed)
- Timestamp and Device ID (from Dashcam or Mobile App)
- Bounding box coordinates & area
- Depth measurements (cm) & engineering severity classifications
- Image file paths (raw frame + annotated visualization)
- Spatial queries: Find nearby potholes within radius (Haversine formula)
"""

import math
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

DB_PATH = Path(__file__).resolve().parent / "potholes.db"


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path = DB_PATH) -> None:
    """Initialize the detections table schema."""
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                device_id TEXT,
                speed_kmh REAL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                altitude REAL DEFAULT 0.0,
                class_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                bbox_x1 REAL NOT NULL,
                bbox_y1 REAL NOT NULL,
                bbox_x2 REAL NOT NULL,
                bbox_y2 REAL NOT NULL,
                bbox_width REAL NOT NULL,
                bbox_height REAL NOT NULL,
                bbox_area REAL NOT NULL,
                estimated_depth_cm REAL NOT NULL,
                depth_class TEXT NOT NULL,
                severity TEXT NOT NULL,
                repair_urgency TEXT NOT NULL,
                frame_image_path TEXT NOT NULL,
                annotated_image_path TEXT NOT NULL,
                notes TEXT
            );
        """)
        # Index on GPS coordinates for fast spatial lookup
        conn.execute("CREATE INDEX IF NOT EXISTS idx_gps ON detections (latitude, longitude);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON detections (timestamp);")
        conn.commit()


def insert_detection(record: Dict[str, Any], db_path: Path = DB_PATH) -> int:
    """Insert a single detection record into SQLite."""
    init_db(db_path)
    sql = """
        INSERT INTO detections (
            timestamp, device_id, speed_kmh, latitude, longitude, altitude,
            class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
            bbox_width, bbox_height, bbox_area,
            estimated_depth_cm, depth_class, severity, repair_urgency,
            frame_image_path, annotated_image_path, notes
        ) VALUES (
            :timestamp, :device_id, :speed_kmh, :latitude, :longitude, :altitude,
            :class_name, :confidence, :bbox_x1, :bbox_y1, :bbox_x2, :bbox_y2,
            :bbox_width, :bbox_height, :bbox_area,
            :estimated_depth_cm, :depth_class, :severity, :repair_urgency,
            :frame_image_path, :annotated_image_path, :notes
        )
    """
    with get_connection(db_path) as conn:
        cursor = conn.execute(sql, record)
        conn.commit()
        return cursor.lastrowid


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in km."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_nearby_potholes(lat: float, lon: float, radius_km: float = 1.0, limit: int = 50, db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieve potholes within a radius (km) of specified GPS coordinates."""
    init_db(db_path)
    # Bounding box rough filter for efficiency (~1 deg lat ~ 111 km)
    delta_lat = radius_km / 111.0
    delta_lon = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))

    with get_connection(db_path) as conn:
        query = """
            SELECT * FROM detections
            WHERE latitude BETWEEN ? AND ?
              AND longitude BETWEEN ? AND ?
        """
        rows = conn.execute(query, (lat - delta_lat, lat + delta_lat, lon - delta_lon, lon + delta_lon)).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        dist_km = haversine_distance_km(lat, lon, d["latitude"], d["longitude"])
        if dist_km <= radius_km:
            d["distance_meters"] = round(dist_km * 1000.0, 1)
            results.append(d)

    # Sort by nearest first
    results.sort(key=lambda x: x["distance_meters"])
    return results[:limit]


def get_all_potholes(limit: int = 100, offset: int = 0, severity: Optional[str] = None, db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieve potholes with optional severity filter."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        if severity:
            rows = conn.execute(
                "SELECT * FROM detections WHERE severity = ? ORDER BY id DESC LIMIT ? OFFSET ?",
                (severity, limit, offset)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM detections ORDER BY id DESC LIMIT ? OFFSET ?",
                (limit, offset)
            ).fetchall()
        return [dict(r) for r in rows]


def get_db_stats(db_path: Path = DB_PATH) -> Dict[str, Any]:
    """Retrieve statistical summary of potholes logged in database."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
        by_sev = dict(conn.execute("SELECT severity, COUNT(*) FROM detections GROUP BY severity").fetchall())
        by_class = dict(conn.execute("SELECT class_name, COUNT(*) FROM detections GROUP BY class_name").fetchall())
        latest = conn.execute("SELECT timestamp, latitude, longitude FROM detections ORDER BY id DESC LIMIT 1").fetchone()

        return {
            "total_detections": total,
            "by_severity": {
                "Low": by_sev.get("Low", 0),
                "Moderate": by_sev.get("Moderate", 0),
                "High": by_sev.get("High", 0),
                "Critical": by_sev.get("Critical", 0)
            },
            "by_class": by_class,
            "latest_record": dict(latest) if latest else None
        }
