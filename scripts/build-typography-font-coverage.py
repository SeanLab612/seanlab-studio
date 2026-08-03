from __future__ import annotations

import json
import hashlib
from pathlib import Path
import sys

from fontTools.ttLib import TTFont


if len(sys.argv) != 3:
    raise SystemExit("usage: build-typography-font-coverage.py <font-file> <output-json>")

source = Path(sys.argv[1])
output = Path(sys.argv[2])
font = TTFont(source, lazy=True)
codepoints: set[int] = set()
for table in font["cmap"].tables:
    if table.isUnicode():
        codepoints.update(table.cmap)

ranges: list[list[int]] = []
for codepoint in sorted(codepoints):
    if ranges and codepoint == ranges[-1][1] + 1:
        ranges[-1][1] = codepoint
    else:
        ranges.append([codepoint, codepoint])

payload = {
    "schemaVersion": "1.0",
    "familyId": "wenkai-narrative",
    "sourceFile": source.name,
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "codepointCount": len(codepoints),
    "ranges": ranges,
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
print(f"{source} -> {output} ({len(codepoints)} codepoints, {len(ranges)} ranges)")
