"""SQLite Database Manager for Pothole and Road Distress Detections.

Stores detection records with:
- Image paths & timestamps
- GPS coordinates (latitude, longitude, altitude)
- Bounding box metrics
- Depth classification & severity grades
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

DB_PATH = Path("potholes.db")


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path = DB_PATH) -> None:
    """Initialize the potholes table schema."""
    with get_connection(db_path) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                image_name TEXT NOT NULL,
                image_path TEXT NOT NULL,
                annotated_path TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                altitude REAL,
                class_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                bbox_x1 REAL NOT NULL,
                bbox_y1 REAL NOT NULL,
                bbox_x2 REAL NOT NULL,
                bbox_y2 REAL NOT NULL,
                bbox_width REAL NOT NULL,
                bbox_height REAL NOT NULL,
                bbox_area REAL NOT NULL,
                depth_score REAL NOT NULL,
                depth_class TEXT NOT NULL,
                estimated_depth_cm REAL,
                severity TEXT NOT NULL,
                repair_urgency TEXT NOT NULL,
                notes TEXT
            );
        """)
        conn.commit()


def insert_detection(detection_data: Dict[str, Any], db_path: Path = DB_PATH) -> int:
    """Insert a single detection record into the database."""
    init_db(db_path)
    sql = """
        INSERT INTO detections (
            timestamp, image_name, image_path, annotated_path,
            latitude, longitude, altitude, class_name, confidence,
            bbox_x1, bbox_y1, bbox_x2, bbox_y2,
            bbox_width, bbox_height, bbox_area,
            depth_score, depth_class, estimated_depth_cm,
            severity, repair_urgency, notes
        ) VALUES (
            :timestamp, :image_name, :image_path, :annotated_path,
            :latitude, :longitude, :altitude, :class_name, :confidence,
            :bbox_x1, :bbox_y1, :bbox_x2, :bbox_y2,
            :bbox_width, :bbox_height, :bbox_area,
            :depth_score, :depth_class, :estimated_depth_cm,
            :severity, :repair_urgency, :notes
        )
    """
    with get_connection(db_path) as conn:
        cursor = conn.execute(sql, detection_data)
        conn.commit()
        return cursor.lastrowid


def get_all_detections(db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieve all detections from the database."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM detections ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]


def get_detection_stats(db_path: Path = DB_PATH) -> Dict[str, Any]:
    """Retrieve summary counts by severity and depth class."""
    init_db(db_path)
    with get_connection(db_path) as conn:
        total = conn.execute("SELECT COUNT(*) FROM detections").fetchone()[0]
        by_class = conn.execute(
            "SELECT class_name, COUNT(*) FROM detections GROUP BY class_name"
        ).fetchall()
        by_depth = conn.execute(
            "SELECT depth_class, COUNT(*) FROM detections GROUP BY depth_class"
        ).fetchall()
        by_severity = conn.execute(
            "SELECT severity, COUNT(*) FROM detections GROUP BY severity"
        ).fetchall()

        return {
            "total": total,
            "by_class": dict(by_class),
            "by_depth": dict(by_depth),
            "by_severity": dict(by_severity)
        }
