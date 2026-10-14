"""Simulator Client for RoadMitra Dashcam -> Backend Flow.

Simulates:
1. Extracting frames from dashcam footage every 10 seconds (or sequential test frames)
2. Attaching real-time simulated GPS coordinates & vehicle speed
3. Sending HTTP POST multipart request to http://localhost:8000/api/upload-frame
4. Querying nearby potholes within 1 km for live driver alert (GET /api/potholes/nearby)

Usage:
    python test_client.py [--url http://localhost:8000] [--interval 10]
"""

import argparse
import time
from datetime import datetime
from pathlib import Path
import cv2
import requests

ROOT_DIR = Path(__file__).resolve().parent.parent
VIDEO_PATH = ROOT_DIR / "stock-footage-damaged-road-with-puddles-and-deep-potholes.webm"
IMAGE_PATH = ROOT_DIR / "model" / "images.jpg"


def test_upload_frame(server_url: str, img_bytes: bytes, filename: str, lat: float, lon: float, speed: float = 35.0):
    endpoint = f"{server_url}/api/upload-frame"

    files = {
        "file": (filename, img_bytes, "image/jpeg")
    }
    data = {
        "latitude": lat,
        "longitude": lon,
        "speed_kmh": speed,
        "device_id": "dashcam_roadmitra_01",
        "timestamp": datetime.now().isoformat(),
        "conf": 0.20,
        "run_depth": "true"
    }

    t0 = time.time()
    try:
        response = requests.post(endpoint, files=files, data=data, timeout=30)
        elapsed = time.time() - t0
        if response.status_code == 200:
            res_json = response.json()
            potholes = res_json.get("potholes_found", 0)
            print(f"  [SUCCESS] Upload successful in {elapsed:.2f}s!")
            print(f"     Frame ID: {res_json.get('frame_id')}")
            print(f"     GPS: {lat:.5f}, {lon:.5f} | Speed: {speed} km/h")
            print(f"     Potholes Detected: {potholes}")
            for d in res_json.get("detections", []):
                print(f"       -> #{d.get('id')} {d.get('class_name')} ({d.get('confidence')*100:.1f}%) | Est. Depth: {d.get('estimated_depth_cm')}cm ({d.get('severity')})")
            print(f"     Annotated URL: {res_json.get('annotated_image_url')}")
            return res_json
        else:
            print(f"  [ERROR] {response.status_code}: {response.text}")
    except Exception as e:
        print(f"  [ERROR] Connection failed to {endpoint}: {e}")
    return None


def test_nearby_alert(server_url: str, lat: float, lon: float, radius_km: float = 1.0):
    endpoint = f"{server_url}/api/potholes/nearby"
    params = {"lat": lat, "lon": lon, "radius_km": radius_km}
    try:
        res = requests.get(endpoint, params=params, timeout=10)
        if res.status_code == 200:
            data = res.json()
            nearby = data.get("potholes", [])
            print(f"\n[DRIVER PROXIMITY ALERT] Found {len(nearby)} potholes within {radius_km} km:")
            for p in nearby[:3]:
                print(f"   [WARNING] Pothole #{p.get('id')} ({p.get('severity')} - {p.get('estimated_depth_cm')}cm deep) is {p.get('distance_meters')}m ahead!")
    except Exception as e:
        print(f"  Nearby query failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="Dashcam Client Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--interval", type=int, default=10, help="Interval in seconds between frames (default: 10)")
    parser.add_argument("--num-frames", type=int, default=3, help="Number of frames to send for testing (default: 3)")
    args = parser.parse_args()

    print("=" * 70)
    print(" ROADMITRA DASHCAM TRANSMISSION SIMULATOR")
    print("=" * 70)
    print(f"Target Backend: {args.url}")
    print(f"Transmission Interval: Every {args.interval}s")

    # Start GPS coordinates (e.g. Connaught Place / Ring Road, Delhi)
    base_lat = 28.6139
    base_lon = 77.2090

    cap = None
    if VIDEO_PATH.exists():
        cap = cv2.VideoCapture(str(VIDEO_PATH))
        print(f"Source: Dashcam video '{VIDEO_PATH.name}'")
    else:
        print(f"Source: Still image '{IMAGE_PATH.name}'")

    for i in range(args.num_frames):
        step_lat = base_lat + (i * 0.0003)  # Vehicle moves along road
        step_lon = base_lon + (i * 0.0002)

        print(f"\n[Transmitting Frame {i+1}/{args.num_frames}] Time: {datetime.now().strftime('%H:%M:%S')}")

        if cap and cap.isOpened():
            # Seek frame (e.g. 0s, 3s, 6s)
            frame_num = min(int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) - 1, i * 60)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if not ret:
                break
            _, buf = cv2.imencode(".jpg", frame)
            img_bytes = buf.tobytes()
        elif IMAGE_PATH.exists():
            with open(IMAGE_PATH, "rb") as f:
                img_bytes = f.read()
        else:
            print("No test image or video available.")
            return

        test_upload_frame(args.url, img_bytes, f"dashcam_frame_{i+1}.jpg", step_lat, step_lon, speed=42.5)

        # Proximity alert query for driver
        test_nearby_alert(args.url, step_lat, step_lon, radius_km=0.5)

        if i < args.num_frames - 1:
            print(f"\nWaiting {args.interval}s until next dashcam transmission...")
            time.sleep(args.interval)

    if cap:
        cap.release()

    print("\n" + "=" * 70)
    print(" [SUCCESS] Transmission simulation finished!")
    print(f" View live GIS Map at: {args.url}/api/map")
    print(f" Check Backend Health at: {args.url}/api/health")
    print("=" * 70)


if __name__ == "__main__":
    main()
