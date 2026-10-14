"""Process sample_video.mp4 using YOLO26s_RDD_Base.

Generates:
1. Full annotated 720p HD MP4 video with real-time HUD dashboard
2. High-resolution snapshot of peak pothole detection
3. Total metrics and breakdown across all 375 frames

Usage:
    python process_sample_video.py
"""

from pathlib import Path
import time
import cv2
from ultralytics import YOLO

EXP_DIR = Path(__file__).resolve().parent
ROOT_DIR = EXP_DIR.parent
MODEL_PATH = EXP_DIR / "YOLO26s_RDD_Base.pt"
VIDEO_PATH = ROOT_DIR / "sample_video.mp4"

# Colors (BGR)
BOX_COLOR = (68, 68, 239)     # Red for Pothole (D40)
LABEL_BG = (220, 38, 38)      # Crimson banner


def main():
    if not VIDEO_PATH.exists():
        print(f"Error: {VIDEO_PATH} not found.")
        return

    print("=" * 75)
    print(" 🎬 PROCESSING SAMPLE_VIDEO.MP4 WITH YOLO26s_RDD_BASE")
    print("=" * 75)
    print(f"📹 Input Video: {VIDEO_PATH.name}")

    cap = cv2.VideoCapture(str(VIDEO_PATH))
    if not cap.isOpened():
        print("Cannot open video.")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"📐 Resolution: {width}x{height} (720p HD) | FPS: {fps:.2f} | Total Frames: {total_frames} ({duration:.1f}s)")
    print(f"⏳ Loading YOLO26s model from {MODEL_PATH.name}...")
    model = YOLO(str(MODEL_PATH))

    out_vid_path = EXP_DIR / "sample_video_detected.mp4"
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(str(out_vid_path), fourcc, fps, (width, height))

    frame_idx = 0
    total_detections = 0
    frames_with_potholes = 0
    best_frame = None
    best_conf = 0.0
    peak_potholes_in_frame = 0

    t0 = time.time()
    print("🚀 Processing 375 frames with real-time pothole detection...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        t_sec = frame_idx / fps

        # Predict
        results = model.predict(frame, conf=0.15, verbose=False)[0]
        boxes = results.boxes
        num_boxes = len(boxes)

        if num_boxes > 0:
            frames_with_potholes += 1
            total_detections += num_boxes

        annotated = frame.copy()

        for b in boxes:
            cls_id = int(b.cls[0])
            cls_name = model.names[cls_id]
            conf = float(b.conf[0])
            x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]

            # Draw box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), BOX_COLOR, 3)

            # Draw tag banner
            label = f"{cls_name} {conf*100:.1f}%"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            cv2.rectangle(annotated, (x1, max(0, y1 - th - 10)), (x1 + tw + 10, y1), LABEL_BG, -1)
            cv2.putText(annotated, label, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

            if conf > best_conf:
                best_conf = conf
                best_frame = annotated.copy()

        if num_boxes > peak_potholes_in_frame:
            peak_potholes_in_frame = num_boxes

        # Draw HUD Banner on top of frame
        overlay = annotated.copy()
        cv2.rectangle(overlay, (0, 0), (width, 46), (15, 23, 42), -1)
        cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)

        hud_title = f"ROAD HAZARD DETECTOR (YOLO26s) | Frame: {frame_idx}/{total_frames} ({t_sec:.1f}s) | Active Potholes: {num_boxes}"
        cv2.putText(annotated, hud_title, (20, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (56, 189, 248), 2)

        writer.write(annotated)

        if frame_idx % 50 == 0 or frame_idx == total_frames:
            pct = (frame_idx / total_frames) * 100
            print(f"  Frame {frame_idx:3d}/{total_frames} ({pct:5.1f}%) | Active Potholes: {num_boxes} (Peak in video: {peak_potholes_in_frame})")

    cap.release()
    writer.release()
    elapsed = time.time() - t0

    if best_frame is not None:
        snap_path = EXP_DIR / "sample_video_peak_snapshot.jpg"
        cv2.imwrite(str(snap_path), best_frame)
        print(f"📸 Saved peak pothole snapshot (Conf: {best_conf*100:.1f}%) -> {snap_path}")

    print("-" * 75)
    print(f"✅ Video processing complete in {elapsed:.1f}s ({total_frames / elapsed:.1f} FPS)!")
    print(f"📊 Total Pothole Detections: {total_detections} across {frames_with_potholes}/{total_frames} frames")
    print(f"🎯 Peak Confidence: {best_conf*100:.1f}% | Max Potholes in a Single Frame: {peak_potholes_in_frame}")
    print(f"🎬 Output video saved: '{out_vid_path}'")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    main()
