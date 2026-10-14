"""Run the fine-tuned RDD2022 RF-DETR Nano detector on an image.

Outputs an annotated image (boxes + class labels) and a JSON file with the
per-detection results.

Usage:
    python run_inference.py [image_path] [threshold]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import supervision as sv
from PIL import Image

import rfdetr

MODEL_PATH = Path("ai-models/rdd2022-rfdetr-nano/checkpoint_best_total.pth")

IMG_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("images.jpg")
THRESHOLD = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25

OUT_DIR = Path("outputs")
OUT_DIR.mkdir(exist_ok=True)


def main() -> None:
    print(f"Loading model from {MODEL_PATH} ...")
    model = rfdetr.RFDETRNano.from_checkpoint(str(MODEL_PATH), trust_checkpoint=True)
    class_names = model.class_names
    print(f"Model classes: {class_names}")

    print(f"Running inference on {IMG_PATH} (threshold={THRESHOLD}) ...")
    result = model.predict(str(IMG_PATH), threshold=THRESHOLD)
    detections = result[0] if isinstance(result, list) else result

    # Per-detection class names (populated by rfdetr, fall back to the model list).
    if "class_name" in detections.data:
        det_class_names = [str(n) for n in detections.data["class_name"]]
    else:
        det_class_names = [class_names[int(c)] for c in detections.class_id]

    records = []
    for box, score, cid, cname in zip(
        detections.xyxy, detections.confidence, detections.class_id, det_class_names
    ):
        records.append(
            {
                "class_id": int(cid),
                "class_name": cname,
                "confidence": round(float(score), 4),
                "bbox_xyxy": [round(float(v), 2) for v in box],
            }
        )

    records.sort(key=lambda r: r["confidence"], reverse=True)

    image = np.asarray(Image.open(IMG_PATH).convert("RGB"))
    height, width = image.shape[:2]

    payload = {
        "image": IMG_PATH.name,
        "image_width": int(width),
        "image_height": int(height),
        "model": "dronefreak/rdd2022-rfdetr-nano",
        "threshold": THRESHOLD,
        "classes": class_names,
        "num_detections": len(records),
        "detections": records,
    }

    json_path = OUT_DIR / f"{IMG_PATH.stem}_detections.json"
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print(f"Wrote JSON -> {json_path}")

    # Annotate: boxes + "class confidence" labels.
    labels = [f"{c} {s:.2f}" for c, s in zip(det_class_names, detections.confidence)]
    annotated = image.copy()
    annotated = sv.BoxAnnotator(thickness=2).annotate(annotated, detections)
    annotated = sv.LabelAnnotator(text_scale=0.5, text_thickness=1).annotate(
        annotated, detections, labels=labels
    )

    out_img = OUT_DIR / f"{IMG_PATH.stem}_annotated.jpg"
    Image.fromarray(np.asarray(annotated)).save(out_img)
    print(f"Wrote annotated image -> {out_img}")

    print(f"\nDetections: {len(records)}")
    for r in records:
        print(
            f"  {r['class_name']:<20} {r['confidence']:.2f}  "
            f"box={r['bbox_xyxy']}"
        )


if __name__ == "__main__":
    main()
