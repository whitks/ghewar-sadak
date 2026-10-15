"""AI Detection and Depth Estimation Engine for Pothole Backend.

Handles:
- Multi-Model Support:
  * "fast": Real-Time Lightweight Pothole Detector (~15ms latency)
  * "accurate": Multi-Class Road Defect Detector (Cracks, Potholes, Road Distress)
- Real-Time Frame Annotation (High FPS JPEG encoding with metadata headers)
- Monocular Depth Estimation via Depth Anything V2 (optional) or Real-Time Heuristic
- Always processes ALL defect classes (never filters to potholes only)
- Default confidence threshold: 0.15
"""

import time
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional, Union
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
    "Low": (16, 185, 129),       # Emerald Green
    "Moderate": (11, 158, 245),  # Amber / Orange
    "High": (68, 68, 239),       # Red
    "Critical": (246, 92, 139)   # Purple
}

CLASS_DISPLAY_NAMES = {
    "0": "Longitudinal Crack",
    "1": "Transverse Crack",
    "2": "Alligator Crack",
    "3": "Pothole",
    "4": "Road Distress (Other)",
    "D00": "Longitudinal Crack",
    "D10": "Transverse Crack",
    "D20": "Alligator Crack",
    "D40": "Pothole",
    "Other": "Road Distress (Other)"
}


class PotholeDetectorEngine:
    """Manages multi-model loading, real-time object detection, and 3D depth computation."""

    def __init__(self, default_model: str = "fast"):
        # Model path registry
        fast_path = ROOT_DIR / "model" / "fast" / "best.pt"
        if not fast_path.exists():
            fast_path = ROOT_DIR / "pothole-cv-experiment" / "best.pt"

        self.model_registry: Dict[str, Dict[str, Any]] = {
            "fast": {
                "name": "Fast Pothole Detector (High-FPS Real-Time)",
                "path": fast_path,
                "default_conf": 0.15,
                "description": "Optimized lightweight model for real-time video/camera streaming (15-25ms latency)",
                "classes": ["Pothole"],
            },
            "accurate": {
                "name": "Accurate Multi-Class Road Defect Detector",
                "path": ROOT_DIR / "model" / "final-classification" / "best.pt",
                "default_conf": 0.15,
                "description": "Comprehensive road distress detector (Longitudinal Crack, Transverse Crack, Alligator Crack, Pothole, Other)",
                "classes": ["Longitudinal Crack", "Transverse Crack", "Alligator Crack", "Pothole", "Other"],
            }
        }

        # Loaded model instances cache
        self.loaded_models: Dict[str, YOLO] = {}

        # Resolve requested default key or find first available model on disk
        requested_key = self.resolve_model_key(default_model)
        self.default_key = self.get_available_key(requested_key)
        self.model = self.get_model(self.default_key)

        # Backwards compatibility attributes
        self.model_path = self.model_registry[self.default_key]["path"]

    def resolve_model_key(self, model_name: Optional[str]) -> str:
        """Normalize user input to a canonical model key: 'fast' or 'accurate'."""
        if not model_name:
            return "fast"
        s = str(model_name).lower().strip()
        if any(k in s for k in ["acc", "slow", "multi", "class", "final", "deep"]):
            return "accurate"
        return "fast"

    def get_available_key(self, preferred_key: str = "fast") -> str:
        """Return preferred_key if weights exist on disk, otherwise the first existing model in registry."""
        key = self.resolve_model_key(preferred_key)
        reg = self.model_registry.get(key)
        if reg and reg["path"].exists():
            return key
        # Fallback to any existing model in registry
        for k, v in self.model_registry.items():
            if v["path"].exists():
                return k
        return key

    def get_model(self, model_key: str) -> YOLO:
        """Fetch or lazy-load the requested YOLO model from cache with robust fallback."""
        key = self.resolve_model_key(model_key)
        if key not in self.loaded_models:
            reg = self.model_registry.get(key)
            if not reg or not reg["path"].exists():
                fallback = self.get_available_key("accurate" if key == "fast" else "fast")
                reg = self.model_registry.get(fallback)
                if not reg or not reg["path"].exists():
                    raise FileNotFoundError("No trained YOLO model weights found in repository.")
                print(f"⚠️ Requested model '{key}' not found on disk. Falling back to '{fallback}'.")
                key = fallback

            if key not in self.loaded_models:
                print(f"⏳ Loading YOLO [{key}] from: {reg['path']} ...")
                self.loaded_models[key] = YOLO(str(reg["path"]))
                print(f"  YOLO [{key}] loaded successfully. Classes: {self.loaded_models[key].names}")

        return self.loaded_models[key]

    def list_available_models(self) -> Dict[str, Any]:
        """Returns details about all available models and their readiness."""
        info = {}
        for key, conf in self.model_registry.items():
            path_exists = conf["path"].exists()
            size_mb = round(conf["path"].stat().st_size / (1024 * 1024), 1) if path_exists else 0
            info[key] = {
                "name": conf["name"],
                "key": key,
                "available": path_exists,
                "loaded_in_memory": key in self.loaded_models,
                "file_size_mb": size_mb,
                "default_conf": conf["default_conf"],
                "description": conf["description"],
                "classes": conf["classes"],
                "path": str(conf["path"].name)
            }
        return info

    def format_class_name(self, raw_name: str, cls_id: int) -> str:
        """Standardize raw model class name to a readable format."""
        s = str(raw_name).strip()
        if "D00" in s or "longitudinal" in s.lower():
            return "Longitudinal Crack"
        if "D10" in s or "transverse" in s.lower():
            return "Transverse Crack"
        if "D20" in s or "alligator" in s.lower():
            return "Alligator Crack"
        if "D40" in s or "pothole" in s.lower():
            return "Pothole"
        if "other" in s.lower() or s == "4":
            return "Road Distress (Other)"
        return CLASS_DISPLAY_NAMES.get(str(cls_id), s)

    def process_image(
        self,
        image_bgr: np.ndarray,
        model_name: str = "fast",
        conf_threshold: float = 0.15,
        camera_height_cm: float = 120.0,
        k_scale: float = 10.0,
        run_depth: bool = False,
        draw_hud: bool = True
    ) -> Tuple[List[Dict[str, Any]], np.ndarray]:
        """
        Detect road defects, estimate depth in cm, and return detections + annotated image.
        
        Important:
        - conf_threshold defaults to 0.15 (as requested)
        - classes=None ensures ALL defect types are detected (never potholes-only)
        - run_depth=False defaults for real-time speed (15-25ms); heuristic depth used.
        """
        h, w = image_bgr.shape[:2]
        key = self.resolve_model_key(model_name)
        model = self.get_model(key)

        t_start = time.time()

        # 1. Run YOLO inference on ALL classes (never filter out classes!)
        results = model.predict(
            source=image_bgr,
            conf=conf_threshold,
            classes=None,  # All classes are detected (never potholes-only)
            verbose=False
        )[0]
        boxes = results.boxes

        # 2. Compute Depth Anything V2 disparity map ONLY if explicitly requested
        disp_map = None
        if run_depth and len(boxes) > 0 and depth_classifier is not None:
            try:
                disp_map = depth_classifier.load_disparity(image_bgr)
            except Exception as e:
                print(f"Depth Anything V2 warning: {e}")
                disp_map = None

        annotated_img = image_bgr.copy()
        detections = []

        for idx, b in enumerate(boxes, 1):
            cls_id = int(b.cls[0])
            raw_cls_name = str(model.names.get(cls_id, cls_id))
            cls_name = self.format_class_name(raw_cls_name, cls_id)
            conf = float(b.conf[0])
            x1, y1, x2, y2 = [int(round(v)) for v in b.xyxy[0].tolist()]
            bw, bh = max(1, x2 - x1), max(1, y2 - y1)

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
                # Real-Time Depth Heuristic (0.01 ms execution)
                area_ratio = (bw * bh) / (w * h)
                if "pothole" in cls_name.lower():
                    depth_cm = round(max(2.0, min(12.0, 3.2 + area_ratio * 160.0)), 1)
                    if depth_cm >= 6.5:
                        severity, band, urgency = "Critical", "Severe", "Immediate Action Required"
                    elif depth_cm >= 4.5:
                        severity, band, urgency = "High", "Deep", "Priority Repair (24-48h)"
                    elif depth_cm >= 2.5:
                        severity, band, urgency = "Moderate", "Moderate", "Scheduled Maintenance"
                    else:
                        severity, band, urgency = "Low", "Shallow", "Routine Inspection"
                else:
                    # Cracks and surface distress
                    depth_cm = round(max(1.0, min(3.5, 1.5 + area_ratio * 40.0)), 1)
                    severity = "Moderate" if "alligator" in cls_name.lower() or depth_cm > 2.5 else "Low"
                    band = "Surface Distress"
                    urgency = "Scheduled Maintenance"

            box_color = SEV_COLORS.get(severity, (11, 158, 245))

            # Draw bounding box
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), box_color, 2)

            # Draw label badge
            label = f"{cls_name} {conf*100:.0f}% | ~{depth_cm}cm"
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

        # Top HUD Banner
        if draw_hud:
            elapsed_ms = round((time.time() - t_start) * 1000, 1)
            hud_bg = (24, 43, 30)
            cv2.rectangle(annotated_img, (0, 0), (w, 36), hud_bg, -1)
            hud_text = (
                f"RoadMitra AI Vision | Model: {key.upper()} | Conf: {conf_threshold} | "
                f"Defects: {len(detections)} | Latency: {elapsed_ms}ms"
            )
            cv2.putText(annotated_img, hud_text, (12, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1)

        return detections, annotated_img

    def annotate_jpeg_bytes(
        self,
        image_input: Union[np.ndarray, bytes],
        model_name: str = "fast",
        conf_threshold: float = 0.15,
        run_depth: bool = False,
        draw_hud: bool = True,
        jpeg_quality: int = 85
    ) -> Tuple[bytes, List[Dict[str, Any]], float]:
        """
        Takes image BGR array or raw image bytes, runs real-time inference,
        and returns (annotated_jpeg_bytes, detections, elapsed_ms).
        """
        t0 = time.time()
        if isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image_bgr is None:
                raise ValueError("Could not decode image bytes")
        else:
            image_bgr = image_input

        detections, annotated_bgr = self.process_image(
            image_bgr=image_bgr,
            model_name=model_name,
            conf_threshold=conf_threshold,
            run_depth=run_depth,
            draw_hud=draw_hud
        )

        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), max(30, min(100, jpeg_quality))]
        success, buffer = cv2.imencode('.jpg', annotated_bgr, encode_param)
        if not success:
            raise RuntimeError("Failed to encode annotated image to JPEG")

        elapsed_ms = round((time.time() - t0) * 1000, 1)
        return buffer.tobytes(), detections, elapsed_ms
