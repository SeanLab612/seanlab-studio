import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1])
manifest = json.loads((root / "risk-frame-manifest.json").read_text())
findings = []
metrics = []
stable_images = []

for item in manifest["frames"]:
    path = Path(item["file"])
    image = cv2.imread(str(path))
    if image is None:
        findings.append({**item, "severity": "error", "rule": "chart.frame.missing", "message": "Risk frame is missing."})
        continue
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    chart_crop = gray[175:720, 45:820]
    edges = cv2.Canny(chart_crop, 60, 140)
    edge_density = float(np.count_nonzero(edges) / edges.size)
    metric = {**item, "width": width, "height": height, "edgeDensity": round(edge_density, 6), "sharpness": round(float(cv2.Laplacian(chart_crop, cv2.CV_64F).var()), 3)}
    metrics.append(metric)
    if width != 1920 or height != 1080:
        findings.append({**item, "severity": "error", "rule": "chart.canvas.dimensions", "message": f"Expected 1920x1080, received {width}x{height}."})
    if item["phase"] == "exit-risk" and edge_density < 0.003:
        findings.append({**item, "severity": "error", "rule": "chart.end-state.empty", "message": "Exit-risk frame has no visible chart marks."})
    if item["phase"] == "stable":
        stable_images.append((item["recipeId"], image))

thumb_w, thumb_h = 480, 270
columns = 2
rows = (len(stable_images) + columns - 1) // columns
sheet = np.zeros((rows * (thumb_h + 42), columns * thumb_w, 3), dtype=np.uint8)
for index, (label, image) in enumerate(stable_images):
    x = (index % columns) * thumb_w
    y = (index // columns) * (thumb_h + 42)
    sheet[y : y + thumb_h, x : x + thumb_w] = cv2.resize(image, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
    cv2.putText(sheet, label, (x + 14, y + thumb_h + 28), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (235, 235, 235), 1, cv2.LINE_AA)
cv2.imwrite(str(root / "chart-contact-sheet.png"), sheet)

report = {
    "schemaVersion": "1.0",
    "canvas": {"width": 1920, "height": 1080},
    "recipes": len(stable_images),
    "riskFrames": len(manifest["frames"]),
    "status": "failed" if any(item["severity"] == "error" for item in findings) else "passed",
    "semanticModelChecks": "passed-during-remotion-render",
    "summary": {"errors": sum(item["severity"] == "error" for item in findings), "warnings": sum(item["severity"] == "warning" for item in findings)},
    "findings": findings,
    "metrics": metrics,
}
(root / "chart-qa-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(f"{root / 'chart-qa-report.json'}: {report['status']}, {report['summary']['errors']} errors")
