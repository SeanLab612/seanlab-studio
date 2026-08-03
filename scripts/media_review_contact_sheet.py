#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1])
files = sorted((root / "contact-pages").glob("*.png")) + sorted((root / "risk-frames").glob("*.png"))
thumbs = []
for file in files:
    with Image.open(file) as opened:
        image = opened.convert("RGB")
        image.thumbnail((640, 360), Image.Resampling.LANCZOS)
        tile = Image.new("RGB", (660, 402), "#080c13")
        tile.paste(image, (10, 10))
        ImageDraw.Draw(tile).text((12, 374), file.stem, fill="#dfe9f7")
        thumbs.append(tile)
columns = 3
rows = (len(thumbs) + columns - 1) // columns
sheet = Image.new("RGB", (columns * 660, rows * 402), "#05070b")
for index, tile in enumerate(thumbs):
    sheet.paste(tile, ((index % columns) * 660, (index // columns) * 402))
sheet.save(root / "contact-sheet.jpg", quality=91, optimize=True)
