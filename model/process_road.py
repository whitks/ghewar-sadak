"""End-to-End Pipeline for Pothole Detection, Monocular Depth Estimation, Database Logging, and GIS Mapping.

Integrates:
- YOLOv8s Road Distress & Pothole Detection
- Depth Anything V2 with robust road plane fitting (depth_classifier.py)
- SQLite Database Logging (potholes.db)
- Interactive GIS Leaflet Mapping (outputs/potholes_map.html)
- Disparity Depth Map Visualizer (outputs/<image>_depth_map.jpg)

Usage:
    python process_road.py [image_path] [--conf 0.15] [--camera-height-cm 120] [--k 1.0] [--lat LAT] [--lon LON]
"""

import argparse
from datetime import datetime
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ExifTags
from ultralytics import YOLO

from database import init_db, insert_detection, get_all_detections
import depth_classifier
from map_generator import generate_map_html

MODEL_PATH = Path("final-classification/best.pt")
OUT_DIR = Path("outputs")
OUT_DIR.mkdir(exist_ok=True)


def extract_exif_gps(image_path: Path):
    """Extract GPS coordinates from image EXIF if available."""
    try:
        img = Image.open(image_path)
        exif = img._getexif()
        if not exif:
            return None, None

        gps_info = {}
        for tag_id, value in exif.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            if tag == "GPSInfo":
                for key in value:
                    sub_tag = ExifTags.GPSTAGS.get(key, key)
                    gps_info[sub_tag] = value[key]

        if "GPSLatitude" in gps_info and "GPSLongitude" in gps_info:
            def _convert(coords, ref):
                d, m, s = [float(x) for x in coords]
                val = d + (m / 60.0) + (s / 3600.0)
                if ref in ["S", "W"]:
                    val = -val
                return val

            lat = _convert(gps_info["GPSLatitude"], gps_info.get("GPSLatitudeRef", "N"))
            lon = _convert(gps_info["GPSLongitude"], gps_info.get("GPSLongitudeRef", "E"))
            return lat, lon
    except Exception:
        pass
    return None, None


def parse_args():
    parser = argparse.ArgumentParser(description="Pothole Detection & Depth Logging Pipeline")
    parser.add_argument("image", nargs="?", default="images.jpg", help="Path to input road image")
    parser.add_argument("--conf", type=float, default=0.15, help="Confidence threshold (default: 0.15)")
    parser.add_argument("--camera-height-cm", type=float, default=120.0, help="Camera height above road in cm (default: 120)")
    parser.add_argument("--k", type=float, default=10.0, help="Calibration scaling factor (default: 10.0 for uncalibrated relative)")
    parser.add_argument("--calibration", type=str, default=None, help="Path to calibration.json if fitted")
    parser.add_argument("--lat", type=float, default=None, help="GPS Latitude")
    parser.add_argument("--lon", type=float, default=None, help="GPS Longitude")
    parser.add_argument("--potholes-only", action="store_true", help="Only process class 'Pothole'")
    return parser.parse_args()


def main():
    args = parse_args()
    img_path = Path(args.image)

    if not img_path.exists():
        print(f"Error: Image '{img_path}' not found.")
        return

    # Extract or fallback GPS coordinates
    exif_lat, exif_lon = extract_exif_gps(img_path)
    latitude = args.lat if args.lat is not None else (exif_lat if exif_lat is not None else 28.6139)
    longitude = args.lon if args.lon is not None else (exif_lon if exif_lon is not None else 77.2090)

    # Resolve calibration factor k
    k = args.k
    mae_cm = None
    if args.calibration and Path(args.calibration).exists():
        with open(args.calibration) as f:
            cal = json.load(f)
            k = cal.get("k", k)
            mae_cm = cal.get("leave_one_out_mae_cm")
        print(f"Loaded calibration from {args.calibration}: k={k:.3f}")

    print("=" * 75)
    print(" 🚀 INFRA-SIGHT ROAD ASSESSMENT PIPELINE (DEPTH ANYTHING V2 INTEGRATED)")
    print("=" * 75)
    print(f"📁 Image: {img_path}")
    print(f"📍 GPS Location: {latitude:.5f}, {longitude:.5f} ({'EXIF' if exif_lat else 'Provided/Default'})")
    print(f"🎯 Detection Conf: {args.conf} | Camera Height: {args.camera_height_cm} cm | Scale k: {k}")

    # 1. Load YOLO model & run detection
    print(f"⏳ Loading YOLOv8 from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))
    target_classes = [3] if args.potholes_only else None
    results = model.predict(source=str(img_path), conf=args.conf, classes=target_classes, verbose=False)
    boxes = results[0].boxes

    # 2. Compute Depth Anything V2 Disparity Map once for whole image
    print(f"🌊 Computing Depth Anything V2 disparity map...")
    disp = depth_classifier.load_disparity(str(img_path))

    # Save visual colormapped depth map
    disp_norm = cv2.normalize(disp, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    depth_heatmap = cv2.applyColorMap(disp_norm, cv2.COLORMAP_INFERNO)
    depth_img_path = OUT_DIR / f"{img_path.stem}_depth_map.jpg"
    cv2.imwrite(str(depth_img_path), depth_heatmap)
    print(f"🎨 Saved depth heatmap -> {depth_img_path}")

    img_bgr = cv2.imread(str(img_path))
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Initialize DB
    init_db()

    print(f"\n🔍 Detections Found: {len(boxes)}")
    print("-" * 75)

    logged_detections = []
    annotated_img = img_bgr.copy()

    for idx, box in enumerate(boxes, 1):
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0].tolist()]
        w, h = round(x2 - x1, 1), round(y2 - y1, 1)
        area = round(w * h, 1)

        # 3. Call friend's plane-fitting depth estimation
        depth_res = depth_classifier.estimate_depth(
            disp=disp,
            bbox=(x1, y1, x2, y2),
            camera_height_cm=args.camera_height_cm,
            k=k,
            mae_cm=mae_cm
        )

        depth_cm = depth_res.get("depth_cm", 0.0) if depth_res.get("ok") else 0.0
        band = depth_res.get("band", "Shallow")
        idx_val = depth_res.get("index", 0.0)
        snr_val = depth_res.get("snr", 0.0)

        # Map band to standard severity & repair urgency
        if band == "Shallow":
            severity = "Low"
            urgency = "Monitor / Routine Maintenance"
        elif band == "Moderate":
            severity = "Moderate"
            urgency = "Scheduled Repair (1-2 Weeks)"
        else:
            severity = "High"
            urgency = "Priority Repair (24-48h)"

        # GPS jitter for multiple detections
        offset_lat = latitude + (np.random.uniform(-0.0001, 0.0001) if len(boxes) > 1 else 0.0)
        offset_lon = longitude + (np.random.uniform(-0.0001, 0.0001) if len(boxes) > 1 else 0.0)

        record = {
            "timestamp": timestamp_str,
            "image_name": img_path.name,
            "image_path": str(img_path),
            "annotated_path": str(OUT_DIR / f"{img_path.stem}_assessed.jpg"),
            "latitude": round(offset_lat, 6),
            "longitude": round(offset_lon, 6),
            "altitude": 0.0,
            "class_name": cls_name,
            "confidence": round(conf, 4),
            "bbox_x1": x1,
            "bbox_y1": y1,
            "bbox_x2": x2,
            "bbox_y2": y2,
            "bbox_width": w,
            "bbox_height": h,
            "bbox_area": area,
            "depth_score": round(idx_val, 4),
            "depth_class": f"{band} (~{depth_cm}cm)",
            "estimated_depth_cm": depth_cm,
            "severity": severity,
            "repair_urgency": urgency,
            "notes": f"Depth Anything V2 plane-fit (SNR: {snr_val:.1f})"
        }

        det_id = insert_detection(record)
        record["id"] = det_id
        logged_detections.append(record)

        # Color coding
        sev_color_bgr = {
            "Low": (16, 185, 129),       # Green
            "Moderate": (11, 158, 245),  # Amber
            "High": (68, 68, 239),       # Red
        }.get(severity, (255, 255, 255))

        cv2.rectangle(annotated_img, (int(x1), int(y1)), (int(x2), int(y2)), sev_color_bgr, 2)
        label = f"#{det_id} {cls_name} {conf*100:.0f}% | ~{depth_cm}cm ({band})"
        cv2.putText(annotated_img, label, (int(x1), max(15, int(y1) - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0), 2)
        cv2.putText(annotated_img, label, (int(x1), max(15, int(y1) - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

        print(f"[{idx:2d}] #{det_id:<3} {cls_name:<10} Conf: {conf*100:>4.1f}% | Depth: ~{depth_cm:>4.1f} cm ({band:<8}) | Index: {idx_val:.4f} | SNR: {snr_val:>4.1f}")

    # Save annotated assessment image
    out_img_path = OUT_DIR / f"{img_path.stem}_assessed.jpg"
    cv2.imwrite(str(out_img_path), annotated_img)

    # 4. Update Leaflet map
    all_db_records = get_all_detections()
    map_path = generate_map_html(all_db_records)

    print("-" * 75)
    print(f"💾 Logged {len(logged_detections)} detections into SQLite database: 'potholes.db'")
    print(f"🖼️ Saved assessment image: '{out_img_path}'")
    print(f"🎨 Saved depth disparity map: '{depth_img_path}'")
    print(f"🗺️ Updated interactive GIS map: '{map_path}'")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
