"""Comprehensive Evaluator for TamAko783/YOLO26s_RDD_Base.

Tests on:
1. images.jpg (Image Evaluation + Depth Estimation)
2. stock-footage-damaged-road-with-puddles-and-deep-potholes.webm (Video Evaluation + MP4 generation)

Usage:
    python evaluate_all.py [--conf 0.15]
"""

import argparse
from pathlib import Path
import time
import cv2
import numpy as np
from ultralytics import YOLO

EXP_DIR = Path(__file__).resolve().parent
ROOT_DIR = EXP_DIR.parent
MODEL_PATH = EXP_DIR / "YOLO26s_RDD_Base.pt"

import sys
sys.path.insert(0, str(ROOT_DIR / "model"))
sys.path.insert(0, str(ROOT_DIR))

try:
    import depth_classifier
except ImportError:
    depth_classifier = None


# CRDDC Colors (BGR)
CLASS_COLORS = {
    0: (245, 158, 11),   # Longitudinal Crack: Amber
    1: (59, 130, 246),   # Transverse Crack: Blue
    2: (168, 85, 247),   # Alligator Crack: Purple
    3: (68, 68, 239)     # Pothole (D40): Red
}


def run_image_test(img_path: Path, conf: float = 0.15):
    print("\n" + "=" * 75)
    print(f" 🖼️  TEST 1: IMAGE EVALUATION ON {img_path.name}")
    print("=" * 75)

    if not img_path.exists():
        print(f"Image not found at {img_path}")
        return

    model = YOLO(str(MODEL_PATH))
    img_bgr = cv2.imread(str(img_path))
    h, w = img_bgr.shape[:2]

    # Predict
    results = model.predict(img_bgr, conf=conf, verbose=False)[0]
    boxes = results.boxes

    print(f"🎯 Total Detections at conf={conf}: {len(boxes)}")
    print("-" * 75)

    disp = None
    if depth_classifier is not None:
        try:
            print("🌊 Running Depth Anything V2 3D surface depth calculation...")
            disp = depth_classifier.load_disparity(str(img_path))
            disp_norm = cv2.normalize(disp, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            heatmap = cv2.applyColorMap(disp_norm, cv2.COLORMAP_INFERNO)
            cv2.imwrite(str(EXP_DIR / "eval_image_depth.jpg"), heatmap)
        except Exception as e:
            print(f"Depth calculation notice: {e}")
            disp = None

    annotated = img_bgr.copy()

    for idx, b in enumerate(boxes, 1):
        cls_id = int(b.cls[0])
        cls_name = model.names[cls_id]
        score = float(b.conf[0])
        x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]

        depth_str = ""
        if disp is not None and depth_classifier is not None:
            d_res = depth_classifier.estimate_depth(disp, (x1, y1, x2, y2), camera_height_cm=120.0, k=10.0)
            if d_res.get("ok"):
                d_cm = d_res.get("depth_cm", 0.0)
                band = d_res.get("band", "Moderate")
                depth_str = f" | ~{d_cm:.1f}cm ({band})"

        color = CLASS_COLORS.get(cls_id, (0, 255, 0))
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"#{idx} {cls_name} {score*100:.1f}%{depth_str}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(annotated, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

        print(f"[{idx:2d}] {cls_name:<26} Conf: {score*100:>5.1f}% | Box: {[x1, y1, x2, y2]}{depth_str}")

    out_img_path = EXP_DIR / "eval_image_assessed.jpg"
    cv2.imwrite(str(out_img_path), annotated)
    print("-" * 75)
    print(f"💾 Saved annotated image -> {out_img_path}")


def run_video_test(video_path: Path, conf: float = 0.12):
    print("\n" + "=" * 75)
    print(f" 🎬 TEST 2: VIDEO EVALUATION ON {video_path.name}")
    print("=" * 75)

    if not video_path.exists():
        print(f"Video not found at {video_path}")
        return

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Could not open video {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"📐 Video: {width}x{height} | FPS: {fps:.2f} | Total Frames: {total_frames} ({duration:.1f}s)")
    print(f"🎯 Running inference at conf={conf}...")

    out_vid_path = EXP_DIR / "eval_video_annotated.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(str(out_vid_path), fourcc, fps, (width, height))

    model = YOLO(str(MODEL_PATH))
    frame_idx = 0
    frames_with_detections = 0
    class_tallies = {}
    best_frame = None
    best_conf = 0.0

    t0 = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        t_sec = frame_idx / fps

        results = model.predict(frame, conf=conf, verbose=False)[0]
        boxes = results.boxes

        annotated = frame.copy()
        num_boxes = len(boxes)
        if num_boxes > 0:
            frames_with_detections += 1

        for b in boxes:
            cls_id = int(b.cls[0])
            cls_name = model.names[cls_id]
            score = float(b.conf[0])
            x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]

            class_tallies[cls_name] = class_tallies.get(cls_name, 0) + 1

            if score > best_conf:
                best_conf = score
                best_frame = annotated.copy()

            color = CLASS_COLORS.get(cls_id, (0, 165, 255))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{cls_name} {score*100:.0f}%"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), color, -1)
            cv2.putText(annotated, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

        # Draw HUD Banner
        overlay = annotated.copy()
        cv2.rectangle(overlay, (0, 0), (width, 38), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)

        hud_text = f"YOLO26s_RDD_Base | Frame {frame_idx}/{total_frames} ({t_sec:.1f}s) | Active Defects: {num_boxes}"
        cv2.putText(annotated, hud_text, (15, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (56, 189, 248), 1)

        writer.write(annotated)

        if frame_idx % 45 == 0 or frame_idx == total_frames:
            pct = (frame_idx / total_frames) * 100
            print(f"  Frame {frame_idx:3d}/{total_frames} ({pct:4.1f}%) | Active Defects: {num_boxes}")

    cap.release()
    writer.release()
    elapsed = time.time() - t0

    if best_frame is not None:
        snap_path = EXP_DIR / "eval_video_snapshot.jpg"
        cv2.imwrite(str(snap_path), best_frame)
        print(f"📸 Saved peak detection snapshot -> {snap_path}")

    print("-" * 75)
    print(f"✅ Video processing complete in {elapsed:.1f}s ({total_frames/elapsed:.1f} FPS)!")
    print(f"📊 Defect detections across video by class: {class_tallies}")
    print(f"🎞️ Frames with active detections: {frames_with_detections}/{total_frames}")
    print(f"🎬 Saved output video -> {out_vid_path}")
    print("=" * 75 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Evaluate YOLO26s on image and video")
    parser.add_argument("--conf", type=float, default=0.15, help="Confidence threshold for image")
    parser.add_argument("--video-conf", type=float, default=0.10, help="Confidence threshold for video")
    args = parser.parse_args()

    # Resolve image path
    candidates_img = [
        ROOT_DIR / "model" / "images.jpg",
        ROOT_DIR / "images.jpg"
    ]
    img_path = next((p for p in candidates_img if p.exists()), None)

    # Resolve video path
    candidates_vid = [
        ROOT_DIR / "stock-footage-damaged-road-with-puddles-and-deep-potholes.webm",
        ROOT_DIR / "model" / "stock-footage-damaged-road-with-puddles-and-deep-potholes.webm"
    ]
    vid_path = next((p for p in candidates_vid if p.exists()), None)

    if img_path:
        run_image_test(img_path, conf=args.conf)
    if vid_path:
        run_video_test(vid_path, conf=args.video_conf)


if __name__ == "__main__":
    main()
