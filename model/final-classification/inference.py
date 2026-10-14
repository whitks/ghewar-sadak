from ultralytics import YOLO

model = YOLO("best.pt")

source = input("Enter image/video path: ") or "image.jpg"
results = model.predict(source, conf=0.25, save=True, line_width=2, show_labels=True, show_conf=True)
print(f"Results saved. Check runs/detect/")
