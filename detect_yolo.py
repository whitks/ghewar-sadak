"""Run YOLOv8 Pothole & Road Distress Detection on an image.

Usage:
    python detect_yolo.py [image_path] [--conf CONF] [--potholes-only]

Example:
    python detect_yolo.py images.jpg
    python detect_yolo.py images.jpg --conf 0.25
    python detect_yolo.py images.jpg --potholes-only
"""

import argparse
import json
from pathlib import Path
import cv2
from PIL import Image
from ultralytics import YOLO

MODEL_PATH = Path("final-classification/best.pt")
OUT_DIR = Path("outputs")
OUT_DIR.mkdir(exist_ok=True)


def parse_args():
    parser = argparse.ArgumentParser(description="YOLOv8 Pothole Detection")
    parser.add_argument("image", nargs="?", default="images.jpg", help="Path to input image")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--potholes-only", action="store_true", help="Only detect and highlight potholes")
    return parser.parse_args()


def main():
    args = parse_args()
    img_path = Path(args.image)

    if not img_path.exists():
        print(f"Error: Image '{img_path}' not found.")
        return

    if not MODEL_PATH.exists():
        print(f"Error: Model weights '{MODEL_PATH}' not found.")
        return

    print(f"Loading YOLOv8 model from {MODEL_PATH}...")
    model = YOLO(str(MODEL_PATH))

    # In this model:
    # 0: Longitudinal Crack, 1: Transverse Crack, 2: Alligator Crack, 3: Pothole, 4: Other (patches/distress)
    if args.potholes_only:
        target_classes = [3]
    else:
        target_classes = None

    print(f"Running inference on {img_path} (confidence={args.conf}, potholes_only={args.potholes_only})...")
    results = model.predict(
        source=str(img_path),
        conf=args.conf,
        classes=target_classes,
        save=False,
        verbose=False
    )

    res = results[0]
    boxes = res.boxes

    records = []
    for box in boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]

        records.append({
            "class_id": cls_id,
            "class_name": cls_name,
            "confidence": round(conf, 4),
            "bbox_xyxy": xyxy
        })

    # Sort by confidence descending
    records.sort(key=lambda x: x["confidence"], reverse=True)

    # Save annotated image
    suffix = "_potholes_only" if args.potholes_only else "_yolo_detected"
    out_img_path = OUT_DIR / f"{img_path.stem}{suffix}.jpg"
    annotated_img = res.plot(line_width=2)
    cv2.imwrite(str(out_img_path), annotated_img)

    # Save JSON summary
    out_json_path = OUT_DIR / f"{img_path.stem}{suffix}.json"
    summary = {
        "image": img_path.name,
        "model": "vinothvikas1987/pothole-detection-yolov8",
        "confidence_threshold": args.conf,
        "total_detections": len(records),
        "detections": records
    }
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Print results summary
    print("\n" + "=" * 60)
    print(f" DETECTION RESULTS ({len(records)} found)")
    print("=" * 60)
    if not records:
        print("No distress/potholes detected at this confidence threshold.")
    else:
        for idx, r in enumerate(records, 1):
            tag = "★ POTHOLE" if r["class_name"].lower() == "pothole" else r["class_name"]
            print(f"[{idx}] {tag:<18} Conf: {r['confidence'] * 100:>5.1f}%   Box: {r['bbox_xyxy']}")

    print("=" * 60)
    print(f"Annotated image saved -> {out_img_path}")
    print(f"JSON report saved     -> {out_json_path}\n")


if __name__ == "__main__":
    main()
