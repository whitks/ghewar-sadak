"""
pothole_depth.py - APPROXIMATE pothole depth from a single image.

Pipeline
--------
1. Your YOLO detector gives a bounding box.
2. A monocular depth model (Depth Anything V2 etc.) gives a relative
   disparity (inverse-depth) map for the whole 1.
3. We fit a plane to the disparity in a ring AROUND the box. A flat road is a
   plane in inverse-depth space, so this ring models "where the road surface
   would be" under the pothole.
4. Inside the box, how far the disparity drops below that plane, relative to
   the plane's disparity, is the depression index:
        index = (plane_disparity - observed_disparity) / plane_disparity
   For small depths this is ~ vertical depth / camera height, so
        depth_cm ~= k * index * camera_height_cm
   where k is a calibration factor fitted from holes you measured by hand
   (needed because the model's disparity has an unknown scale and shift).
5. Report a band + estimate + "+/- error" from your calibration. Never
   present this as a measured depth.

Usage
-----
  python pothole_depth.py selftest
  python pothole_depth.py calibrate --csv cal.csv --out calibration.json
  python pothole_depth.py estimate --image road.jpg --bbox 410 520 640 700 \
        --camera-height-cm 120 --calibration calibration.json

cal.csv columns:
  image,x1,y1,x2,y2,camera_height_cm,measured_depth_cm

Install for real use:
  pip install numpy pillow torch transformers
"""
import argparse
import csv
import json
import sys

import numpy as np

# Adjustable assumptions, NOT engineering standards.
BANDS = [(2.0, "Shallow"), (5.0, "Moderate"), (float("inf"), "Deep")]

# Relative model by default. For a metric model (outputs metres), pass
# --metric so we convert depth to disparity (1/depth) internally.
DEFAULT_MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def band_for(depth_cm, bands=BANDS):
    for limit, name in bands:
        if depth_cm < limit:
            return name
    return bands[-1][1]


# ---------------------------------------------------------------- geometry
def _fit_plane(u, v, d, iters=4, k=2.5):
    """Robust least-squares plane d = a*u + b*v + c with MAD outlier trimming."""
    A = np.c_[u, v, np.ones_like(u)]
    mask = np.ones(len(d), dtype=bool)
    coef = np.zeros(3)
    for _ in range(iters):
        coef, *_ = np.linalg.lstsq(A[mask], d[mask], rcond=None)
        res = d - A @ coef
        med = np.median(res[mask])
        mad = np.median(np.abs(res[mask] - med)) * 1.4826 + 1e-9
        new_mask = np.abs(res - med) < k * mad
        if new_mask.sum() < 50:
            break
        mask = new_mask
    return coef, mask


def depression_index(disp, bbox, ring_margin=0.5, inner_shrink=0.15, pct=85):
    """
    disp : 2D float array, larger = closer (inverse depth), same size as image.
    bbox : (x1, y1, x2, y2) pixels.
    Returns dict with index and quality info, or {"ok": False, "reason": ...}.
    """
    H, W = disp.shape
    x1, y1, x2, y2 = [int(round(c)) for c in bbox]
    x1, x2 = max(0, min(x1, x2)), min(W, max(x1, x2))
    y1, y2 = max(0, min(y1, y2)), min(H, max(y1, y2))
    bw, bh = x2 - x1, y2 - y1
    if bw < 8 or bh < 8:
        return {"ok": False, "reason": "box too small"}

    mx, my = int(bw * ring_margin), int(bh * ring_margin)
    X1, Y1 = max(0, x1 - mx), max(0, y1 - my)
    X2, Y2 = min(W, x2 + mx), min(H, y2 + my)

    yy, xx = np.mgrid[Y1:Y2, X1:X2]
    pad_x, pad_y = int(bw * 0.05), int(bh * 0.05)  # keep rim damage out of ring
    inside_padded = (
        (xx >= x1 - pad_x) & (xx < x2 + pad_x) & (yy >= y1 - pad_y) & (yy < y2 + pad_y)
    )
    ring = ~inside_padded
    if ring.sum() < 200:
        return {"ok": False, "reason": "not enough road pixels around the box"}

    crop = disp[Y1:Y2, X1:X2]
    u = xx[ring] / W
    v = yy[ring] / H
    coef, inl = _fit_plane(u, v, crop[ring])
    inlier_frac = float(inl.mean())

    ring_res = crop[ring] - np.c_[u, v, np.ones_like(u)] @ coef
    noise = float(np.std(ring_res[inl])) + 1e-9

    sx, sy = int(bw * inner_shrink), int(bh * inner_shrink)
    ix1, ix2, iy1, iy2 = x1 + sx, x2 - sx, y1 + sy, y2 - sy
    if ix2 <= ix1 or iy2 <= iy1:
        return {"ok": False, "reason": "inner region empty"}
    iy, ix = np.mgrid[iy1:iy2, ix1:ix2]
    plane_in = coef[0] * (ix / W) + coef[1] * (iy / H) + coef[2]
    drop = plane_in - disp[iy1:iy2, ix1:ix2]  # >0 means farther than road => hole
    delta = float(np.percentile(drop, pct))

    cx, cy = (x1 + x2) / 2 / W, (y1 + y2) / 2 / H
    d0 = float(coef[0] * cx + coef[1] * cy + coef[2])
    if d0 <= 1e-6:
        return {"ok": False, "reason": "invalid plane disparity at box centre"}

    index = max(delta, 0.0) / d0
    snr = delta / noise
    return {
        "ok": True,
        "index": index,
        "snr": float(snr),
        "ring_inlier_fraction": inlier_frac,
        "low_confidence": bool(snr < 3.0 or inlier_frac < 0.6),
    }


def estimate_depth(disp, bbox, camera_height_cm, k=1.0, mae_cm=None):
    r = depression_index(disp, bbox)
    if not r["ok"]:
        return r
    depth_cm = k * r["index"] * camera_height_cm
    r.update(
        depth_cm=round(depth_cm, 1),
        band=band_for(depth_cm),
        approx_error_cm=mae_cm,
        calibrated=(k != 1.0),
        label="APPROXIMATE estimated depth - not a measurement",
    )
    return r


# ------------------------------------------------------------- depth model
_DEPTH_PIPE_CACHE = {}


def get_depth_pipeline(model_id=DEFAULT_MODEL):
    """Singleton getter to prevent reloading weights on every single frame."""
    if model_id not in _DEPTH_PIPE_CACHE:
        from transformers import pipeline
        _DEPTH_PIPE_CACHE[model_id] = pipeline("depth-estimation", model=model_id)
    return _DEPTH_PIPE_CACHE[model_id]


def load_disparity(image_input, model_id=DEFAULT_MODEL, metric=False):
    """
    Computes disparity map from an image path, PIL Image, or numpy BGR/RGB array.
    Uses cached pipeline to avoid reloading transformer weights on every keyframe.
    """
    import torch
    from PIL import Image

    if isinstance(image_input, Image.Image):
        img = image_input.convert("RGB")
    elif isinstance(image_input, np.ndarray):
        # Convert OpenCV BGR to RGB
        if image_input.ndim == 3 and image_input.shape[2] == 3:
            img = Image.fromarray(image_input[:, :, ::-1])
        else:
            img = Image.fromarray(image_input).convert("RGB")
    else:
        img = Image.open(str(image_input)).convert("RGB")

    pipe = get_depth_pipeline(model_id=model_id)
    out = pipe(img)["predicted_depth"]
    t = out if out.ndim == 4 else out.unsqueeze(0)
    if t.ndim == 3:
        t = t.unsqueeze(0)
    t = torch.nn.functional.interpolate(
        t.float(), size=(img.height, img.width), mode="bicubic", align_corners=False
    )
    arr = t.squeeze().cpu().numpy().astype(np.float64)
    if metric:  # model outputs metres: convert to disparity
        arr = 1.0 / np.maximum(arr, 1e-3)
    return arr


# -------------------------------------------------------------- calibration
def calibrate(rows, disparities):
    """Fit k through the origin: measured = k * (index * camera_height)."""
    xs, ys, used = [], [], []
    for r in rows:
        res = depression_index(disparities[r["image"]], r["bbox"])
        if not res["ok"]:
            print(f"skip {r['image']}: {res['reason']}", file=sys.stderr)
            continue
        xs.append(res["index"] * r["camera_height_cm"])
        ys.append(r["measured_depth_cm"])
        used.append(r["image"])
    xs, ys = np.array(xs), np.array(ys)
    if len(xs) < 3:
        raise SystemExit("Need at least 3 usable measured potholes (aim for 8+).")
    k = float((xs * ys).sum() / (xs * xs).sum())
    mae = float(np.mean(np.abs(k * xs - ys)))
    loo = []  # leave-one-out error: the honest number to report
    for i in range(len(xs)):
        m = np.arange(len(xs)) != i
        ki = (xs[m] * ys[m]).sum() / (xs[m] * xs[m]).sum()
        loo.append(abs(ki * xs[i] - ys[i]))
    return {
        "k": k,
        "n": int(len(xs)),
        "train_mae_cm": round(mae, 2),
        "leave_one_out_mae_cm": round(float(np.mean(loo)), 2),
    }


# ----------------------------------------------------------------- selftest
def _synthetic(hole_frac, H=480, W=640):
    """Planar road disparity + a hole whose disparity is lower by hole_frac."""
    yy, xx = np.mgrid[0:H, 0:W]
    disp = 0.2 + 0.0008 * yy + 0.0001 * xx  # affine in pixels = planar road
    rng = np.random.default_rng(0)
    disp = disp + rng.normal(0, 0.002, disp.shape)
    box = (280, 300, 380, 380)
    x1, y1, x2, y2 = box
    disp[y1:y2, x1:x2] *= 1.0 - hole_frac
    return disp, box


def selftest():
    ok = True
    for frac in (0.0, 0.02, 0.05, 0.10):
        disp, box = _synthetic(frac)
        r = depression_index(disp, box)
        print(f"hole_frac={frac:.2f} -> index={r['index']:.3f} snr={r['snr']:.1f}")
        ok &= abs(r["index"] - frac) < 0.015
    # calibration: pretend 120 cm camera, true depth = 100*frac cm => k ~ 100/120
    disps = {}
    rows = []
    for i, frac in enumerate((0.02, 0.04, 0.06, 0.08, 0.10)):
        disp, box = _synthetic(frac)
        disps[f"s{i}"] = disp
        rows.append({"image": f"s{i}", "bbox": box,
                     "camera_height_cm": 120.0, "measured_depth_cm": 100 * frac})
    cal = calibrate(rows, disps)
    print("calibration:", cal)
    ok &= abs(cal["k"] - 100 / 120) < 0.08
    print("SELFTEST", "PASSED" if ok else "FAILED")
    return 0 if ok else 1


# ---------------------------------------------------------------------- CLI
def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("selftest")

    c = sub.add_parser("calibrate")
    c.add_argument("--csv", required=True)
    c.add_argument("--out", default="calibration.json")
    c.add_argument("--model", default=DEFAULT_MODEL)
    c.add_argument("--metric", action="store_true")

    e = sub.add_parser("estimate")
    e.add_argument("--image", required=True)
    e.add_argument("--bbox", type=float, nargs=4, required=True)
    e.add_argument("--camera-height-cm", type=float, required=True)
    e.add_argument("--calibration")
    e.add_argument("--model", default=DEFAULT_MODEL)
    e.add_argument("--metric", action="store_true")

    a = p.parse_args()
    if a.cmd == "selftest":
        sys.exit(selftest())

    if a.cmd == "calibrate":
        rows, disps = [], {}
        with open(a.csv, newline="") as f:
            for r in csv.DictReader(f):
                rows.append({
                    "image": r["image"],
                    "bbox": (float(r["x1"]), float(r["y1"]), float(r["x2"]), float(r["y2"])),
                    "camera_height_cm": float(r["camera_height_cm"]),
                    "measured_depth_cm": float(r["measured_depth_cm"]),
                })
        for r in rows:
            if r["image"] not in disps:
                disps[r["image"]] = load_disparity(r["image"], a.model, a.metric)
        cal = calibrate(rows, disps)
        json.dump(cal, open(a.out, "w"), indent=2)
        print(json.dumps(cal, indent=2))
        return

    k, mae = 1.0, None
    if a.calibration:
        cal = json.load(open(a.calibration))
        k, mae = cal["k"], cal["leave_one_out_mae_cm"]
    disp = load_disparity(a.image, a.model, a.metric)
    print(json.dumps(estimate_depth(disp, a.bbox, a.camera_height_cm, k, mae), indent=2))


if __name__ == "__main__":
    main()