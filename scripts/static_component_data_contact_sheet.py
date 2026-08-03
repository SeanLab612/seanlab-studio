#!/usr/bin/env python3
import sys
from pathlib import Path

from PIL import Image, ImageDraw


root = Path(sys.argv[1])


def build_sheet(files, output_name, columns=4):
    tiles = []
    for file in files:
        with Image.open(file) as opened:
            image = opened.convert("RGB")
            image.thumbnail((480, 270), Image.Resampling.LANCZOS)
            tile = Image.new("RGB", (500, 310), "#f7f6f2")
            tile.paste(image, ((500 - image.width) // 2, 8))
            label = file.stem.replace("-", " ")
            ImageDraw.Draw(tile).text((12, 286), label, fill="#18231d")
            tiles.append(tile)

    if not tiles:
        return

    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 500, rows * 310), "#e8e7e1")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % columns) * 500, (index // columns) * 310))
    sheet.save(root / output_name, quality=92, optimize=True)


component_files = sorted((root / "components").glob("*.png"))
data_files = sorted((root / "data-effects").glob("*.png"))
animation_files = sorted((root / "animations").glob("*.png"))

build_sheet(component_files, "components-contact-sheet.jpg")
build_sheet(data_files, "data-effects-contact-sheet.jpg")
build_sheet(animation_files, "animation-templates-contact-sheet.jpg", columns=3)
build_sheet(component_files + data_files, "contact-sheet.jpg")
