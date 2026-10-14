"""AI Detection and Depth Estimation Engine for Pothole Backend.

Handles:
- YOLO Pothole Detection (with AAttn compatibility patch)
- Monocular Depth Estimation via Depth Anything V2
- Drawing professional HUD annotations with severity badges
"""

from pathlib import Path
from typing import Dict, List, Any, Tuple
import cv2
import numpy as np
import torch

# ── Patch Ultralytics AAttn for YOLOv12s Compatibility ────────────────────────
import ultralytics.nn.modules.block as block
from ultralytics import YOLO

orig_forward = block.AAttn.forward


def patched_forward(self, x: torch.Tensor) -> torch.Tensor:
    if hasattr(self, 'qk'):
        B, _, H, W = x.shape
        N = H * W
        qkv = torch.cat([self.qk(x), self.v(x)], dim=1).flatten(2).transpose(1, 2)
        if self.area > 1:
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
        if self.area > 1:
            x = x.reshape(B // self.area, N * self.area, self.all_head_dim)
            v = v.reshape(B // self.area, N * self.area, self.all_head_dim)
            B, N, _ = x.shape
        x = x.reshape(B, H, W, self.all_head_dim).permute(0, 3, 1, 2).contiguous()
        v = v.reshape(B, H, W, self.all_head_dim).permute(0, 3, 1, 2).contiguous()
        x = x + self.pe(v)
        return self.proj(x)
    return orig_forward(self, x)

block.AAttn.forward = patched_forward

# Import depth classifier
ROOT_DIR = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(ROOT_DIR / "model"))
sys.path.insert(0, str(ROOT_DIR))

try:
    import depth_classifier
except ImportError:
    depth_classifier = None

SEV_COLORS = {
    "Low": (16, 185, 129),       # Green
    "Moderate": (11, 158, 245),  # Amber
    "High": (68, 68, 239),       # Red
    "Critical": (246, 92, 139)   # Purple
}


class PotholeDetectorEngine:
    """Manages model loading, object detection, and 3D depth computation."""

    def __init__(self, model_path: Path = None):
        if model_path is None or not model_path.exists():
            # Check candidate model paths
            candidates = [
                ROOT_DIR / "pothole-cv-experiment" / "best.pt",
                ROOT_DIR / "model" / "final-classification" / "best.pt",
                ROOT_DIR / "final-classification" / "best.pt",
            ]
            model_path = next((p for p in candidates if p.exists()), None)

        if not model_path:
            raise FileNotFoundError("Could not find any trained YOLO model weights.")

        self.model_path = model_path
        print(f"Loading YOLO model from: {self.model_path}")
        self.model = YOLO(str(self.model_path))

    def process_image(
        self,
        image_bgr: np.ndarray,
        conf_threshold: float = 0.20,
        camera_height_cm: float = 120.0,
        k_scale: float = 10.0,
        run_depth: bool = True
    ) -> Tuple[List[Dict[str, Any]], np.ndarray]:
        """Detect potholes in image, compute depth and return detections + annotated image."""
        h, w = image_bgr.shape[:2]

        # 1. Run YOLO inference
        results = self.model.predict(image_bgr, conf=conf_threshold, verbose=False)[0]
        boxes = results.boxes

        # 2. Compute Depth Anything V2 disparity map if depth enabled
        disp_map = None
        if run_depth and len(boxes) > 0 and depth_classifier is not None:
            try:
                # Use RGB image for transformers depth model
                img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                from PIL import Image as PILImage
                pil_img = PILImage.fromarray(img_rgb)
                from transformers import pipeline
                pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
                out = pipe(pil_img)["predicted_depth"]
                t = out if out.ndim == 4 else out.unsqueeze(0)
                if t.ndim == 3:
                    t = t.unsqueeze(0)
                t = torch.nn.functional.interpolate(t.float(), size=(h, w), mode="bicubic", align_corners=False)
                disp_map = t.squeeze().cpu().numpy().astype(np.float64)
            except Exception as e:
                print(f"Depth Anything V2 warning: {e}")
                disp_map = None

        annotated_img = image_bgr.copy()
        detections = []

        for idx, b in enumerate(boxes, 1):
            cls_id = int(b.cls[0])
            cls_name = self.model.names[cls_id]
            conf = float(b.conf[0])
            x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]
            bw, bh = x2 - x1, y2 - y1

            # Estimate depth
            depth_cm = 4.0
            band = "Moderate"
            severity = "Moderate"
            urgency = "Scheduled Repair (1-2 Weeks)"
            idx_val = 0.003

            if disp_map is not None and depth_classifier is not None:
                d_res = depth_classifier.estimate_depth(disp_map, (x1, y1, x2, y2), camera_height_cm, k_scale)
                if d_res.get("ok"):
                    depth_cm = float(d_res.get("depth_cm", 4.0))
                    band = d_res.get("band", "Moderate")
                    idx_val = float(d_res.get("index", 0.003))

                    if band == "Shallow":
                        severity = "Low"
                        urgency = "Routine Maintenance"
                    elif band == "Moderate":
                        severity = "Moderate"
                        urgency = "Scheduled Repair (1-2 Weeks)"
                    else:
                        severity = "High"
                        urgency = "Priority Repair (24-48h)"
            else:
                # Fast heuristic when depth neural net is skipped
                area_ratio = (bw * bh) / (w * h)
                depth_cm = round(max(1.5, min(10.0, 3.0 + area_ratio * 150.0)), 1)
                severity = "High" if depth_cm >= 5.0 else ("Moderate" if depth_cm >= 2.5 else "Low")
                band = "Deep" if depth_cm >= 5.0 else ("Moderate" if depth_cm >= 2.5 else "Shallow")

            box_color = SEV_COLORS.get(severity, (11, 158, 245))

            # Draw box on annotated image
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), box_color, 2)
            label = f"{cls_name} {conf*100:.0f}% | ~{depth_cm}cm ({band})"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated_img, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), box_color, -1)
            cv2.putText(annotated_img, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)

            detections.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": [x1, y1, x2, y2],
                "width": bw,
                "height": bh,
                "area": bw * bh,
                "estimated_depth_cm": depth_cm,
                "depth_class": f"{band} (~{depth_cm}cm)",
                "depth_score": round(idx_val, 4),
                "severity": severity,
                "repair_urgency": urgency
            })

        return detections, annotated_img
