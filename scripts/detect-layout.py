import json
import sys
from pathlib import Path

import cv2


def select_layout_template(center: float):
    if center < 0.42:
        return "right", 0.92, "speaker-left-overlay-right"
    if center > 0.58:
        return "left", 0.92, "speaker-right-overlay-left"
    return "left", 0.78, "speaker-center-left"


def detect_layout(config_path: str):
    config = json.loads(Path(config_path).read_text())
    source = str(Path(config["source"]).resolve())
    cap = cv2.VideoCapture(source)
    frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    centers = []
    boxes = []
    for ratio in (0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frames * ratio))
        ok, frame = cap.read()
        if not ok:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(120, 120))
        if len(faces):
            x, y, w, h = max(faces, key=lambda box: box[2] * box[3])
            centers.append((x + w / 2) / frame.shape[1])
            boxes.append([int(x), int(y), int(w), int(h)])
    cap.release()
    center = sum(centers) / len(centers) if centers else 0.5
    side, scale, template_id = select_layout_template(center)
    result = {
        "faceCenterX": round(center, 4),
        "detections": len(centers),
        "overlaySide": side,
        "overlayScale": scale,
        "layoutTemplateId": template_id,
        "sampleBoxes": boxes,
    }
    output = Path(config["editDir"]) / "layout-manifest.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return output


if __name__ == "__main__":
    print(detect_layout(sys.argv[1] if len(sys.argv) > 1 else "config/workflow-test.json"))
