# YOLO26s Road Damage Detection (CRDDC Baseline)

This experiment folder contains the evaluation setup for **[TamAko783/YOLO26s_RDD_Base](https://huggingface.co/TamAko783/YOLO26s_RDD_Base)** integrated with our end-to-end pipeline (Detection + Depth Anything V2 3D surface plane fitting + SQLite logging + Leaflet GIS mapping).

---

## Model Specifications

* **Model File**: `YOLO26s_RDD_Base.pt` (19.38 MB, 9M parameters)
* **Dataset**: Unified Road Defect Dataset (4,509 validation images, 11,470 ground truth boxes)
* **Task**: Object Detection (`detect`)
* **Classes (CRDDC Standard)**:
  * `0: Longitudinal Crack (D00)` - mAP@50: 63.0%, Precision: 69.9%
  * `1: Transverse Crack (D10)` - mAP@50: 66.9%, Precision: 71.0%
  * `2: Alligator Crack (D20)` - mAP@50: 71.5%, Precision: 74.2%
  * `3: Pothole (D40)` - **mAP@50: 73.3%, Precision: 77.4%, F1: 70.6%**

---

## Contents of this Folder

* **`YOLO26s_RDD_Base.pt`**: Trained model weights.
* **`test_pipeline.py`**: Standalone evaluation runner connecting YOLO26s to Depth Anything V2, SQLite, and Leaflet.
* **`output_pipeline_assessed.jpg`**: Evaluated test image with bounding boxes, depth in cm, and severity badges.
* **`output_depth_heatmap.jpg`**: 3D surface disparity heatmap (Depth Anything V2).
* **`potholes_map.html`**: Interactive GIS map plotting detected defects.
* **`yolo26_eval.db`**: SQLite database storing logged detections with coordinates, depth, and timestamps.

---

## How to Run

```powershell
# Run pipeline on default test image:
python yolo26-experiment/test_pipeline.py

# Run on any custom image with custom confidence:
python yolo26-experiment/test_pipeline.py --image path/to/image.jpg --conf 0.15

# View the interactive map:
Start-Process yolo26-experiment/potholes_map.html
```
