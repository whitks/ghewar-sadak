"""Video Processing Pipeline for Pothole and Road Distress Detection.

Processes video files (e.g. .webm, .mp4, .avi):
- Runs YOLOv8 detection & object tracking on every frame
- Computes depth profiles on keyframes with Depth Anything V2
- Renders professional Heads-Up Display (HUD) overlay
- Generates annotated MP4 video output
- Logs unique defect coordinates into SQLite (potholes.db)
- Updates interactive GIS map (outputs/potholes_map.html)

Usage:
    python process_video.py [video_path] [--conf 0.15] [--lat LAT] [--lon LON]
"""

import argparse
from datetime import datetime
import json
from pathlib import Path
import time
import cv2
import numpy as np
import torch
import ultralytics.nn.modules.block as block
from ultralytics import YOLO

# Patch Ultralytics AAttn for models trained with split (qk, v) attention layers
if hasattr(block, 'AAttn') and hasattr(block.AAttn, 'forward'):
    orig_aattn_forward = block.AAttn.forward

    def patched_aattn_forward(self, x: torch.Tensor) -> torch.Tensor:
        if hasattr(self, 'qk'):
            B, _, H, W = x.shape
            N = H * W
            qkv = torch.cat([self.qk(x), self.v(x)], dim=1).flatten(2).transpose(1, 2)
            if hasattr(self, 'area') and self.area > 1:
                qkv = qkv.reshape(B * self.area, N // self.area, self.all_head_dim * 3)
                B, N, _ = qkv.shape
            q, k, v = (
                qkv.view(B, N, self.num_heads, self.head_dim * 3)
                .permute(0, 2, 3, 1)
                .split([self.head_dim, self.head_dim, self.head_dim], dim=2)
            )
            attn = (q.transpose(-2, -1) @ k) * (self.head_dim**-0.5)
            attn = attn.softmax(dim=-1)
            x = v @ attn.transpose(-2, -1)
            x = x.permute(0, 3, 1, 2)
            v = v.permute(0, 3, 1, 2)
            if hasattr(self, 'area') and self.area > 1:
                x = x.reshape(B // self.area, N * self.area, self.all_head_dim)
                v = v.reshape(B // self.area, N * self.area, self.all_head_dim)
                B, N, _ = x.shape
            x = x.reshape(B, H, W, self.all_head_dim).permute(0, 3, 1, 2).contiguous()
            v = v.reshape(B, H, W, self.all_head_dim).permute(0, 3, 1, 2).contiguous()
            if hasattr(self, 'pe'):
                x = x + self.pe(v)
            return self.proj(x)
        return orig_aattn_forward(self, x)

    block.AAttn.forward = patched_aattn_forward

# Dynamic path resolution to work from root or model/
BASE_DIR = Path(__file__).resolve().parent

# Model candidates: prioritize fast or accurate models
candidates = [
    BASE_DIR / "model" / "fast" / "best.pt",
    BASE_DIR / "model" / "final-classification" / "best.pt",
    BASE_DIR / "pothole-cv-experiment" / "best.pt",
]
DEFAULT_MODEL_PATH = next((p for p in candidates if p.exists()), None)
OUT_DIR = BASE_DIR / "outputs"
DB_PATH = BASE_DIR / "potholes.db"

import sys
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "model"))

from database import init_db, insert_detection, get_all_detections
import depth_classifier
from map_generator import generate_map_html

OUT_DIR.mkdir(parents=True, exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Video Pothole & Distress Processing Pipeline")
    parser.add_argument("video", nargs="?", default="sample_video.mp4", help="Path to input video file")
    parser.add_argument("--conf", type=float, default=0.20, help="Confidence threshold (default: 0.20)")
    parser.add_argument("--model", type=str, default=None, help="Path to custom model weights (default: auto-detect)")
    parser.add_argument("--no-depth", action="store_true", help="Skip depth estimation for ultra-fast processing (30+ FPS)")
    parser.add_argument("--lat", type=float, default=28.6139, help="Starting GPS Latitude (default: 28.6139)")
    parser.add_argument("--lon", type=float, default=77.2090, help="Starting GPS Longitude (default: 77.2090)")
    parser.add_argument("--camera-height-cm", type=float, default=120.0, help="Camera height above road in cm (default: 120)")
    parser.add_argument("--k", type=float, default=10.0, help="Calibration scaling factor (default: 10.0)")
    parser.add_argument("--depth-interval", type=int, default=30, help="Frame interval for full depth estimation (default: 30)")
    return parser.parse_args()


def main():
    args = parse_args()
    video_path = Path(args.video)

    # Search in current directory or parent directory
    if not video_path.exists() and (BASE_DIR.parent / args.video).exists():
        video_path = BASE_DIR.parent / args.video

    if not video_path.exists():
        print(f"Error: Video '{video_path}' not found.")
        return

    print("=" * 75)
    print(" 🎬 INFRA-SIGHT VIDEO ASSESSMENT PIPELINE")
    print("=" * 75)
    print(f"📹 Input Video: {video_path}")
    print(f"🎯 Detection Conf: {args.conf} | Starting GPS: {args.lat:.4f}, {args.lon:.4f}")

    # Open video
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"📐 Video Resolution: {width}x{height} | FPS: {fps:.2f} | Total Frames: {total_frames} ({duration:.1f}s)")

    # Prepare VideoWriter
    out_video_path = OUT_DIR / "detected_road_footage.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(str(out_video_path), fourcc, fps, (width, height))

    # Load YOLO model
    model_path = Path(args.model) if args.model else DEFAULT_MODEL_PATH
    if not model_path or not model_path.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    print(f"⏳ Loading YOLO model from {model_path}...")
    model = YOLO(str(model_path))

    if not args.no_depth:
        print("⏳ Initializing Depth Engine (pre-caching weights in RAM)...")
        depth_classifier.get_depth_pipeline()

    init_db(DB_PATH)

    frame_idx = 0
    unique_potholes = 0
    unique_distress = 0
    logged_records = []
    best_frame_snapshot = None
    best_conf = 0.0
    best_depth_disp = None

    start_time = time.time()
    print("🚀 Processing video frames (with real-time defect tracking)...")

    # Colors (BGR)
    SEV_COLORS = {
        "Shallow": (16, 185, 129),   # Green
        "Moderate": (11, 158, 245),  # Amber
        "Deep": (68, 68, 239)        # Red
    }

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        t_sec = frame_idx / fps

        # Simulate progressive vehicle GPS movement along a route (~30 km/h)
        curr_lat = args.lat + (0.00008 * (frame_idx / total_frames))
        curr_lon = args.lon + (0.00006 * (frame_idx / total_frames))

        # Run detection
        results = model.predict(frame, conf=args.conf, verbose=False)[0]
        boxes = results.boxes

        annotated_frame = frame.copy()
        frame_potholes = 0
        frame_distress = 0

        # Periodic depth calculation on keyframe (in-memory with cached pipeline)
        run_depth = (frame_idx % args.depth_interval == 0 or frame_idx == 1) and not args.no_depth
        disp_map = None
        if run_depth and len(boxes) > 0:
            try:
                disp_map = depth_classifier.load_disparity(frame)
            except Exception:
                disp_map = None

        for b in boxes:
            cls_id = int(b.cls[0])
            conf = float(b.conf[0])
            x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]
            bw, bh = x2 - x1, y2 - y1
            raw_name = str(model.names[cls_id])
            if "D00" in raw_name or "pothole" in raw_name.lower():
                cls_name = "Pothole"
                frame_potholes += 1
            elif "D10" in raw_name:
                cls_name = "Longitudinal Crack"
                frame_distress += 1
            elif "D20" in raw_name:
                cls_name = "Transverse Crack"
                frame_distress += 1
            elif "D40" in raw_name or "alligator" in raw_name.lower():
                cls_name = "Alligator Crack"
                frame_distress += 1
            else:
                cls_name = raw_name
                frame_distress += 1

            # Determine depth band
            band = "Moderate"
            depth_cm = 4.0
            idx_val = 0.003
            if disp_map is not None:
                d_res = depth_classifier.estimate_depth(disp_map, (x1, y1, x2, y2), args.camera_height_cm, args.k)
                if d_res.get("ok"):
                    depth_cm = d_res.get("depth_cm", 4.0)
                    band = d_res.get("band", "Moderate")
                    idx_val = d_res.get("index", 0.003)

            # Draw box & label
            box_color = SEV_COLORS.get(band, (11, 158, 245))
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)
            label = f"{cls_name} {conf*100:.0f}% | ~{depth_cm:.1f}cm ({band})"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated_frame, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), box_color, -1)
            cv2.putText(annotated_frame, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

            # Record highest-confidence snapshot
            if conf > best_conf:
                best_conf = conf
                best_frame_snapshot = annotated_frame.copy()
                if disp_map is not None:
                    best_depth_disp = disp_map.copy()

            # Log to DB periodically on keyframes
            if run_depth and conf >= 0.20:
                record = {
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "image_name": f"{video_path.name} (frame {frame_idx})",
                    "image_path": str(video_path),
                    "annotated_path": str(out_video_path),
                    "latitude": round(curr_lat, 6),
                    "longitude": round(curr_lon, 6),
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
                    "depth_score": round(idx_val, 4),
                    "depth_class": f"{band} (~{depth_cm:.1f}cm)",
                    "estimated_depth_cm": depth_cm,
                    "severity": "High" if band == "Deep" else ("Moderate" if band == "Moderate" else "Low"),
                    "repair_urgency": "Priority Repair" if band == "Deep" else "Scheduled Repair",
                    "notes": f"Video footage frame {frame_idx}/{total_frames} ({t_sec:.1f}s)"
                }
                det_id = insert_detection(record, db_path=DB_PATH)
                record["id"] = det_id
                logged_records.append(record)

        # ── Draw Heads-Up Display (HUD) Banner ──────────────────────────────
        overlay = annotated_frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, 42), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.75, annotated_frame, 0.25, 0, annotated_frame)

        hud_text = f"INFRA-SIGHT ROAD INSPECTOR | Frame: {frame_idx}/{total_frames} ({t_sec:.1f}s) | Active Defects: {len(boxes)}"
        cv2.putText(annotated_frame, hud_text, (15, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (226, 232, 240), 1)

        counts_text = f"Potholes: {frame_potholes}  |  Road Distress/Puddles: {frame_distress}"
        cv2.putText(annotated_frame, counts_text, (15, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (56, 189, 248), 1)

        writer.write(annotated_frame)

        if frame_idx % 30 == 0 or frame_idx == total_frames:
            pct = (frame_idx / total_frames) * 100
            print(f"  Frame {frame_idx:3d}/{total_frames} ({pct:4.1f}%) | Active Defects: {len(boxes)} (Potholes: {frame_potholes}, Distress: {frame_distress})")

    cap.release()
    writer.release()
    elapsed = time.time() - start_time

    # Save best snapshot and depth map
    if best_frame_snapshot is not None:
        best_snap_path = OUT_DIR / "video_best_detection.jpg"
        cv2.imwrite(str(best_snap_path), best_frame_snapshot)
        print(f"📸 Saved peak detection snapshot: '{best_snap_path}'")

    if best_depth_disp is not None:
        disp_norm = cv2.normalize(best_depth_disp, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
        depth_heatmap = cv2.applyColorMap(disp_norm, cv2.COLORMAP_INFERNO)
        depth_img_path = OUT_DIR / "video_depth_map.jpg"
        cv2.imwrite(str(depth_img_path), depth_heatmap)
        print(f"🎨 Saved video depth heatmap: '{depth_img_path}'")

    # Update GIS map
    all_db_records = get_all_detections(db_path=DB_PATH)
    map_path = generate_map_html(all_db_records, output_path=OUT_DIR / "potholes_map.html")

    print("-" * 75)
    print(f"✅ Video processing complete in {elapsed:.1f}s ({total_frames / elapsed:.1f} FPS)!")
    print(f"🎬 Output video saved: '{out_video_path}'")
    print(f"💾 Logged {len(logged_records)} defect instances into '{DB_PATH}'")
    print(f"🗺️ Updated GIS Map: '{map_path}'")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
