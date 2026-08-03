from pathlib import Path
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


if len(sys.argv) != 4:
    raise SystemExit("usage: subset-typography-review-font.py <source-font> <output-woff2> <review-family>")

source = Path(sys.argv[1])
output = Path(sys.argv[2])
family = sys.argv[3].strip()
glyphs = Path(__file__).with_name("typography-review-glyphs.txt").read_text(encoding="utf-8")

options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.notdef_glyph = True
options.recommended_glyphs = True

font = TTFont(source)
worker = subset.Subsetter(options=options)
worker.populate(text=glyphs)
worker.subset(font)

names = font["name"]
for name_id in (1, 2, 4, 6, 16, 17):
    names.names = [record for record in names.names if record.nameID != name_id]
postscript_name = re.sub(r"[^A-Za-z0-9-]", "", family.replace(" ", "-")) + "-Regular"
for platform_id, encoding_id, language_id in ((3, 1, 0x409), (1, 0, 0)):
    names.setName(family, 1, platform_id, encoding_id, language_id)
    names.setName("Regular", 2, platform_id, encoding_id, language_id)
    names.setName(f"{family} Regular", 4, platform_id, encoding_id, language_id)
    names.setName(postscript_name, 6, platform_id, encoding_id, language_id)
    names.setName(family, 16, platform_id, encoding_id, language_id)
    names.setName("Regular", 17, platform_id, encoding_id, language_id)

output.parent.mkdir(parents=True, exist_ok=True)
font.save(output)
print(f"{source} -> {output} ({output.stat().st_size} bytes)")
