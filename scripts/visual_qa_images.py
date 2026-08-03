import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np


manifest_path = Path(sys.argv[1])
contracts_path = Path(sys.argv[2])
output_path = Path(sys.argv[3])
contact_sheet_path = Path(sys.argv[4])
manifest = json.loads(manifest_path.read_text())
contracts = json.loads(contracts_path.read_text())
component_contracts = {item["componentId"]: item for item in contracts["components"]}
layout_contracts = {item["layoutId"]: item for item in contracts["layouts"]}


def dhash(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
    bits = small[:, 1:] > small[:, :-1]
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bit)
    return f"{value:016x}"


metrics = []
stable_thumbs = []
title_thumbs = []
for item in manifest["frames"]:
    image = cv2.imread(item["file"], cv2.IMREAD_COLOR)
    if image is None:
        metrics.append({**item, "missing": True})
        continue
    layout = layout_contracts[item["layoutId"]]
    contract = component_contracts.get(item["componentId"])
    if contract is None and item.get("visualCategory") in (
        "speaker-only",
        "authored-screen",
        "authored-image",
        "animation",
        "title-continuity",
    ):
        # These visual groups are validated by their dedicated QA passes below.
        # They do not use one of the 19 semantic-component content contracts, so
        # image metrics must cover the rendered canvas instead of requiring a
        # component crop that cannot exist.
        crop = image
    elif contract is None:
        raise ValueError(f'No QA content bounds for {item["componentId"]}')
    else:
        rect = contract["contentBounds"]
        offset_x = (layout["contentBounds"][0]["x"] if layout["contentBounds"] else 68) - 68
        x, y, w, h = rect["x"] + offset_x, rect["y"], rect["width"], rect["height"]
        crop = image[max(0, y): min(image.shape[0], y + h), max(0, x): min(image.shape[1], x + w)]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 70, 150)
    row = {
        **item,
        "missing": False,
        "width": int(image.shape[1]),
        "height": int(image.shape[0]),
        "contentMean": round(float(gray.mean()), 3),
        "contentStdDev": round(float(gray.std()), 3),
        "laplacianVariance": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 3),
        "edgeDensity": round(float(np.count_nonzero(edges) / edges.size), 6),
        "dhash": dhash(image),
    }
    metrics.append(row)
    if item.get("visualCategory") == "title-continuity":
        title_thumb = cv2.resize(image, (640, 360), interpolation=cv2.INTER_AREA)
        title_canvas = np.zeros((398, 640, 3), dtype=np.uint8)
        title_canvas[:360] = title_thumb
        title_label = f'{item["cueId"]} | {item["phase"]} | t={item["timeSeconds"]:.2f}s'
        cv2.putText(title_canvas, title_label, (14, 386), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (124, 247, 212), 1, cv2.LINE_AA)
        title_thumbs.append(title_canvas)
    if item["phase"] in ("stable", "screen-stable", "title-stable", "speaker-only"):
        thumb = cv2.resize(image, (480, 270), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((306, 480, 3), dtype=np.uint8)
        canvas[:270] = thumb
        category = item.get("visualCategory", "semantic-component").replace("-", " ").upper()
        label = f'{category} | {item["componentId"]} | t={item["timeSeconds"]:.2f}s'
        color = {
            "SEMANTIC COMPONENT": (255, 189, 69),
            "AUTHORED SCREEN": (110, 168, 255),
            "TITLE CONTINUITY": (124, 247, 212),
            "SPEAKER ONLY": (150, 150, 150),
        }.get(category, (235, 235, 235))
        cv2.putText(canvas, label, (12, 294), cv2.FONT_HERSHEY_SIMPLEX, 0.48, color, 1, cv2.LINE_AA)
        stable_thumbs.append(canvas)

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(
    json.dumps(
        {"schemaVersion": "1.0", "dependencies": {"opencv": cv2.__version__}, "frames": metrics},
        ensure_ascii=False,
        indent=2,
    )
    + "\n"
)

columns = 4
rows = max(1, math.ceil(len(stable_thumbs) / columns))
sheet = np.full((rows * 306, columns * 480, 3), (9, 11, 15), dtype=np.uint8)
for index, thumb in enumerate(stable_thumbs):
    row, column = divmod(index, columns)
    sheet[row * 306 : (row + 1) * 306, column * 480 : (column + 1) * 480] = thumb
contact_sheet_path.parent.mkdir(parents=True, exist_ok=True)
cv2.imwrite(str(contact_sheet_path), sheet)
title_sheet_path = contact_sheet_path.with_name("title-continuity-contact-sheet.png")
if title_thumbs:
    title_columns = 3
    title_rows = math.ceil(len(title_thumbs) / title_columns)
    title_sheet = np.full((title_rows * 398, title_columns * 640, 3), (9, 11, 15), dtype=np.uint8)
    for index, thumb in enumerate(title_thumbs):
        row, column = divmod(index, title_columns)
        title_sheet[row * 398 : (row + 1) * 398, column * 640 : (column + 1) * 640] = thumb
    cv2.imwrite(str(title_sheet_path), title_sheet)
else:
    title_sheet = np.full((398, 640, 3), (9, 11, 15), dtype=np.uint8)
    cv2.putText(title_sheet, "NO TITLE CONTINUITY CUES", (110, 205), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (150, 150, 150), 1, cv2.LINE_AA)
    cv2.imwrite(str(title_sheet_path), title_sheet)
print(output_path)
print(contact_sheet_path)
print(title_sheet_path)
