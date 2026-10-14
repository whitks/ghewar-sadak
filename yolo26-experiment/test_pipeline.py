"""Test YOLO26s_RDD_Base on our full pipeline (Detection + Depth Anything V2 + DB + Map).

Usage:
    python test_pipeline.py [--image ../model/images.jpg] [--conf 0.15]
"""

import argparse
from datetime import datetime
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

EXP_DIR = Path(__file__).resolve().parent
ROOT_DIR = EXP_DIR.parent
MODEL_PATH = EXP_DIR / "YOLO26s_RDD_Base.pt"

import sys
sys.path.insert(0, str(ROOT_DIR / "model"))
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "backend"))

from database import init_db, insert_detection, get_all_potholes
import depth_classifier
from map_generator import generate_map_html

SEV_COLORS = {
    "Low": (16, 185, 129),       # Green
    "Moderate": (11, 158, 245),  # Amber
    "High": (68, 68, 239)        # Red
}


def main():
    parser = argparse.ArgumentParser(description="Test YOLO26 on Pipeline")
    parser.add_argument("--image", default=str(ROOT_DIR / "model" / "images.jpg"), help="Input image path")
    parser.add_argument("--conf", type=float, default=0.15, help="Confidence threshold")
    parser.add_argument("--lat", type=float, default=28.6139, help="GPS Latitude")
    parser.add_argument("--lon", type=float, default=77.2090, help="GPS Longitude")
    args = parser.parse_args()

    img_path = Path(args.image)
    if not img_path.exists():
        print(f"Image '{img_path}' not found.")
        return

    print("=" * 75)
    print(" 🚀 PIPELINE EVALUATION: TamAko783/YOLO26s_RDD_Base")
    print("=" * 75)
    print(f"📁 Image: {img_path.name}")
    print(f"🎯 Confidence: {args.conf} | Starting GPS: {args.lat:.4f}, {args.lon:.4f}")

    # 1. Load model
    print(f"⏳ Loading YOLO26s model from {MODEL_PATH.name}...")
    model = YOLO(str(MODEL_PATH))
    print(f"📋 Model Classes ({len(model.names)}): {model.names}")

    # 2. Run detection
    img_bgr = cv2.imread(str(img_path))
    h, w = img_bgr.shape[:2]
    results = model.predict(img_bgr, conf=args.conf, verbose=False)[0]
    boxes = results.boxes

    print(f"🎯 Detections Found: {len(boxes)}")
    print("-" * 75)

    # 3. Compute Depth Anything V2 Disparity Map
    print("🌊 Computing Depth Anything V2 3D surface depth map...")
    disp = depth_classifier.load_disparity(str(img_path))

    # Save depth heatmap
    disp_norm = cv2.normalize(disp, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    depth_heatmap = cv2.applyColorMap(disp_norm, cv2.COLORMAP_INFERNO)
    depth_heatmap_path = EXP_DIR / "output_depth_heatmap.jpg"
    cv2.imwrite(str(depth_heatmap_path), depth_heatmap)

    annotated_img = img_bgr.copy()
    logged_records = []
    db_path = EXP_DIR / "yolo26_eval.db"
    init_db(db_path)

    for idx, b in enumerate(boxes, 1):
        cls_id = int(b.cls[0])
        cls_name = model.names[cls_id]
        conf = float(b.conf[0])
        x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]
        bw, bh = x2 - x1, y2 - y1

        # 4. Depth estimation with friend's plane fitting
        d_res = depth_classifier.estimate_depth(disp, (x1, y1, x2, y2), camera_height_cm=120.0, k=10.0)
        depth_cm = float(d_res.get("depth_cm", 4.0)) if d_res.get("ok") else 4.0
        band = d_res.get("band", "Moderate") if d_res.get("ok") else "Moderate"
        snr = float(d_res.get("snr", 1.0)) if d_res.get("ok") else 1.0

        severity = "High" if band == "Deep" else ("Moderate" if band == "Moderate" else "Low")
        box_color = SEV_COLORS.get(severity, (11, 158, 245))

        # Draw box and label
        cv2.rectangle(annotated_img, (x1, y1), (x2, y2), box_color, 2)
        label = f"#{idx} {cls_name} {conf*100:.0f}% | ~{depth_cm:.1f}cm ({band})"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(annotated_img, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), box_color, -1)
        cv2.putText(annotated_img, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

        print(f"[{idx}] {cls_name:<24} Conf: {conf*100:>5.1f}% | Depth: ~{depth_cm:>4.1f}cm ({band:<8}) | Box: {[x1, y1, x2, y2]}")

        record = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "device_id": "yolo26_pipeline_test",
            "speed_kmh": 0.0,
            "latitude": args.lat + (0.0001 * idx),
            "longitude": args.lon + (0.0001 * idx),
            "altitude": 0.0,
            "class_name": cls_name,
            "confidence": round(conf, 4),
            "bbox_x1": x1,
            "bbox_y1": y1,
            "bbox_x2": x2,
            "bbox_y2": y2,
            "bbox_width": bw,
            "bbox_height": bh,
            "bbox_area": bw * bh,
            "estimated_depth_cm": depth_cm,
            "depth_class": f"{band} (~{depth_cm:.1f}cm)",
            "severity": severity,
            "repair_urgency": "Priority" if severity == "High" else "Scheduled",
            "frame_image_path": str(img_path),
            "annotated_image_path": str(EXP_DIR / "output_pipeline_assessed.jpg"),
            "notes": f"Evaluated via TamAko783/YOLO26s_RDD_Base"
        }
        rec_id = insert_detection(record, db_path=db_path)
        record["id"] = rec_id
        logged_records.append(record)

    out_assessed_path = EXP_DIR / "output_pipeline_assessed.jpg"
    cv2.imwrite(str(out_assessed_path), annotated_img)

    # 5. Generate interactive GIS map
    map_path = EXP_DIR / "potholes_map.html"
    generate_map_html(logged_records, output_path=map_path)

    print("-" * 75)
    print(f"💾 Logged {len(logged_records)} detections into SQLite: '{db_path.name}'")
    print(f"🖼️ Saved assessed image: '{out_assessed_path}'")
    print(f"🎨 Saved depth heatmap: '{depth_heatmap_path}'")
    print(f"🗺️ Generated GIS Map: '{map_path}'")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
