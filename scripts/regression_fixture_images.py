import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np


def dhash(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = resized[:, 1:] > resized[:, :-1]
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def hamming(left, right):
    return (int(left, 16) ^ int(right, 16)).bit_count()


def make_contact_sheet(rows, output_path):
    tile_w, tile_h, label_h = 480, 270, 42
    columns = 3
    count_rows = (len(rows) + columns - 1) // columns
    canvas = np.full((count_rows * (tile_h + label_h), columns * tile_w, 3), (10, 14, 22), dtype=np.uint8)
    for index, row in enumerate(rows):
        image = cv2.imread(row["file"])
        if image is None:
            continue
        image = cv2.resize(image, (tile_w, tile_h), interpolation=cv2.INTER_AREA)
        x, y = (index % columns) * tile_w, (index // columns) * (tile_h + label_h)
        canvas[y:y + tile_h, x:x + tile_w] = image
        color = (80, 220, 130) if row["status"] in ("passed", "candidate") else (70, 90, 240)
        cv2.putText(canvas, f'{row["id"]}  {row["status"].upper()}', (x + 14, y + tile_h + 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.56, color, 1, cv2.LINE_AA)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(output_path, canvas, [cv2.IMWRITE_JPEG_QUALITY, 88])


def analyze(suite_path, current_dir, baseline_path, report_path, contact_sheet_path):
    suite = json.loads(Path(suite_path).read_text())
    baseline_file = Path(baseline_path)
    baseline = json.loads(baseline_file.read_text()) if baseline_file.exists() else {"entries": []}
    approved = {item["id"]: item for item in baseline.get("entries", [])}
    rows, findings = [], []
    for case in suite["cases"]:
        path = Path(current_dir) / f'{case["id"]}.png'
        image = cv2.imread(str(path))
        if image is None:
            rows.append({"id": case["id"], "file": str(path), "status": "missing"})
            findings.append({"severity": "error", "fixtureId": case["id"], "rule": "frame.missing"})
            continue
        height, width = image.shape[:2]
        digest = dhash(image)
        source_sha = hashlib.sha256(path.read_bytes()).hexdigest()
        expected = approved.get(case["id"])
        distance = hamming(digest, expected["dhash"]) if expected else None
        status = "candidate" if not expected else ("passed" if distance <= baseline.get("hammingThreshold", 10) else "changed")
        if width != 1920 or height != 1080:
            findings.append({"severity": "error", "fixtureId": case["id"], "rule": "frame.dimensions", "actual": [width, height]})
            status = "failed"
        if status == "changed":
            findings.append({"severity": "warning", "fixtureId": case["id"], "rule": "baseline.changed", "distance": distance})
        rows.append({"id": case["id"], "composition": case["composition"], "frame": case["frame"],
                     "file": str(path), "width": width, "height": height, "sha256": source_sha,
                     "dhash": digest, "distance": distance, "status": status})
    summary = {
        "cases": len(suite["cases"]),
        "rendered": sum(row["status"] != "missing" for row in rows),
        "passed": sum(row["status"] == "passed" for row in rows),
        "candidates": sum(row["status"] == "candidate" for row in rows),
        "warnings": sum(item["severity"] == "warning" for item in findings),
        "errors": sum(item["severity"] == "error" for item in findings),
    }
    status = "failed" if summary["errors"] else ("warning" if summary["warnings"] else ("awaiting-human-review" if summary["candidates"] else "passed"))
    report = {"schemaVersion": "1.0", "suiteId": suite["fixtureId"], "status": status, "canvas": suite["canvas"],
              "baseline": str(baseline_path), "baselineStatus": "compared" if approved else "awaiting-human-promotion",
              "summary": summary, "entries": rows, "findings": findings}
    report["reportSha256"] = hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    Path(report_path).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    make_contact_sheet(rows, contact_sheet_path)


def promote(report_path, baseline_path, golden_dir, approved_by):
    report = json.loads(Path(report_path).read_text())
    golden = Path(golden_dir)
    golden.mkdir(parents=True, exist_ok=True)
    entries = []
    for item in report["entries"]:
        image = cv2.imread(item["file"])
        if image is None:
            raise RuntimeError(f'Missing promotion frame: {item["file"]}')
        proxy = golden / f'{item["id"]}.jpg'
        cv2.imwrite(str(proxy), cv2.resize(image, (960, 540), interpolation=cv2.INTER_AREA),
                    [cv2.IMWRITE_JPEG_QUALITY, 88])
        try:
            review_proxy = str(proxy.relative_to(Path.cwd()))
        except ValueError:
            review_proxy = str(proxy)
        entries.append({"id": item["id"], "composition": item["composition"], "frame": item["frame"],
                        "dhash": item["dhash"], "sourceSha256": item["sha256"],
                        "reviewProxy": review_proxy})
    baseline = {"schemaVersion": "1.0", "fixtureId": report["suiteId"], "canvas": report["canvas"],
                "hammingThreshold": 10, "approvedBy": approved_by,
                "approvedAt": datetime.now(timezone.utc).isoformat(),
                "sourceReportSha256": report["reportSha256"], "entries": entries}
    Path(baseline_path).parent.mkdir(parents=True, exist_ok=True)
    Path(baseline_path).write_text(json.dumps(baseline, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    if sys.argv[1] == "analyze" and len(sys.argv) == 7:
        analyze(*sys.argv[2:])
    elif sys.argv[1] == "promote" and len(sys.argv) == 6:
        promote(*sys.argv[2:])
    else:
        raise SystemExit("usage: regression_fixture_images.py analyze <suite> <current-dir> <baseline> <report> <contact-sheet> | promote <report> <baseline> <golden-dir> <approved-by>")
