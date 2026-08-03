#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import date
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public/media-assets/identities"
TS_PATH = ROOT / "src/media-assets/identity-assets.ts"
OLLAMA_OVERRIDE = ROOT / "inputs/identity-overrides/ollama.png"

SPECS = [
    # Local model and AI/design identities.
    ("brand.ollama", "ai", "Ollama", "OL", "https://raw.githubusercontent.com/ollama/ollama/main/docs/ollama-logo.svg", "https://github.com/ollama/ollama", "mit"),
    ("brand.omlx", "ai", "oMLX", "oM", "https://raw.githubusercontent.com/jundot/omlx/main/docs/images/icon-rounded-dark.svg", "https://github.com/jundot/omlx", "apache-2.0"),
    ("brand.huggingface", "ai", "Hugging Face", "HF", "https://huggingface.co/favicon.ico", "https://huggingface.co/", "official-brand-nominative"),
    ("brand.figma", "design", "Figma", "FI", "https://static.figma.com/app/icon/1/favicon.svg", "https://www.figma.com/", "official-brand-nominative"),
    # Biopharma identities.
    ("biotech.lilly", "biotech", "Eli Lilly", "LLY", "https://www.lilly.com/favicon.ico", "https://www.lilly.com/", "official-brand-nominative"),
    ("biotech.astrazeneca", "biotech", "AstraZeneca", "AZN", "https://www.astrazeneca.com/favicon.ico", "https://www.astrazeneca.com/", "official-brand-nominative"),
    ("biotech.roche", "biotech", "Roche", "ROG", "https://www.roche.com/favicon.ico", "https://www.roche.com/", "official-brand-nominative"),
    ("biotech.moderna", "biotech", "Moderna", "MRNA", "https://www.modernatx.com/favicon.ico", "https://www.modernatx.com/", "official-brand-nominative"),
    ("biotech.regeneron", "biotech", "Regeneron", "REGN", "https://www.regeneron.com/favicon.ico", "https://www.regeneron.com/", "official-brand-nominative"),
    # Media identities.
    ("media.reuters", "media", "Reuters", "R", "https://www.reuters.com/favicon.ico", "https://www.reuters.com/", "official-brand-nominative"),
    ("media.bloomberg", "media", "Bloomberg", "B", "https://www.bloomberg.com/favicon.ico", "https://www.bloomberg.com/", "official-brand-nominative"),
    ("media.the-information", "media", "The Information", "TI", "https://www.theinformation.com/favicon.ico", "https://www.theinformation.com/", "official-brand-nominative"),
    # Government and public institutions. Marks are kept nominative and never imply endorsement.
    ("government.white-house", "government", "The White House", "WH", "https://www.whitehouse.gov/favicon.ico", "https://www.whitehouse.gov/", "official-brand-nominative"),
    ("government.sec", "government", "U.S. SEC", "SEC", "https://www.sec.gov/favicon.ico", "https://www.sec.gov/", "official-brand-nominative"),
    ("government.fda", "government", "U.S. FDA", "FDA", "https://www.fda.gov/favicon.ico", "https://www.fda.gov/", "official-brand-nominative"),
    ("government.nih", "government", "U.S. NIH", "NIH", "https://www.nih.gov/themes/custom/nih2_uswds/assets/img/favicons/custom/favicon-192x192.png", "https://www.nih.gov/", "official-brand-nominative"),
    ("government.federal-reserve", "government", "Federal Reserve", "FED", "https://www.federalreserve.gov/favicon.ico", "https://www.federalreserve.gov/", "official-brand-nominative"),
    # Exchanges and ticker contexts.
    ("exchange.nasdaq", "exchange", "Nasdaq", "NASDAQ", "https://www.nasdaq.com/favicon.ico", "https://www.nasdaq.com/", "official-brand-nominative"),
    ("exchange.nyse", "exchange", "NYSE", "NYSE", "https://www.nyse.com/publicdocs/images/favicon_nyse_2022.gif", "https://www.nyse.com/", "official-brand-nominative"),
    ("exchange.hkex", "exchange", "Hong Kong Exchanges", "HKEX", "https://www.hkex.com.hk/assets/images/webclip.png", "https://www.hkex.com.hk/", "official-brand-nominative"),
    # Research and universities.
    ("university.stanford", "university", "Stanford University", "SU", "https://www.stanford.edu/favicon.ico", "https://www.stanford.edu/", "official-brand-nominative"),
    ("university.mit", "university", "MIT", "MIT", "https://www.mit.edu/favicon.ico", "https://www.mit.edu/", "official-brand-nominative"),
    ("university.harvard", "university", "Harvard University", "HU", "https://www.harvard.edu/favicon.ico", "https://www.harvard.edu/", "official-brand-nominative"),
    ("university.tsinghua", "university", "Tsinghua University", "THU", "https://www.tsinghua.edu.cn/favicon.ico", "https://www.tsinghua.edu.cn/", "official-brand-nominative"),
    ("university.peking", "university", "Peking University", "PKU", "https://www.pku.edu.cn/favicon.ico", "https://www.pku.edu.cn/", "official-brand-nominative"),
    ("research.broad", "research", "Broad Institute", "BI", "https://www.broadinstitute.org/sites/default/files/favicon.ico", "https://www.broadinstitute.org/", "official-brand-nominative"),
]

for code, label in [("us", "United States"), ("cn", "China"), ("gb", "United Kingdom"), ("eu", "European Union"), ("jp", "Japan"), ("kr", "South Korea")]:
    SPECS.append((f"country.{code}", "country", label, code.upper(), f"https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/{code}.svg", "https://github.com/lipis/flag-icons", "mit"))

for ticker, label in [("NVDA", "NVIDIA"), ("AAPL", "Apple"), ("MSFT", "Microsoft"), ("AMZN", "Amazon"), ("META", "Meta"), ("TSLA", "Tesla"), ("LLY", "Eli Lilly"), ("NVO", "Novo Nordisk")]:
    SPECS.append((f"ticker.{ticker.lower()}", "ticker", f"{label} ({ticker})", ticker, None, "https://www.nasdaq.com/market-activity/stocks", "official-brand-nominative"))


def hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def acquire(spec, session: requests.Session):
    asset_id, kind, label, short, file_url, page_url, license_id = spec
    output_dir = PUBLIC / asset_id.replace(".", "/")
    output_dir.mkdir(parents=True, exist_ok=True)
    uses_user_override = asset_id == "brand.ollama" and OLLAMA_OVERRIDE.exists()
    effective_license = "user-provided-private" if uses_user_override else license_id
    record = {
        "id": asset_id,
        "kind": kind,
        "label": label,
        "aliases": [],
        "status": "planned",
        "focalPoint": {"x": 0.5, "y": 0.5, "method": "center"},
        "variants": {},
        "fallback": {"type": "text-badge", "value": short},
        "usage": {
            "attributionRequired": effective_license in {"mit", "apache-2.0"},
            "redistribution": "allowed" if effective_license in {"mit", "apache-2.0"} else "restricted",
            "note": "Nominative editorial identification only; do not imply endorsement or alter the mark.",
        },
        "source": {
            "pageUrl": page_url,
            "provider": "User-provided visual override" if uses_user_override else ("Official project/site" if license_id == "official-brand-nominative" else "Open-source project repository"),
            "license": effective_license,
            "accessedAt": date.today().isoformat(),
        },
    }
    if file_url:
        record["source"]["fileUrl"] = file_url
    else:
        record["statusReason"] = "Ticker identities intentionally use a crisp local text badge rather than a company logo."
        return record
    try:
        response_content = None
        content_type = "image/png" if uses_user_override else ""
        if uses_user_override:
            response_content = OLLAMA_OVERRIDE.read_bytes()
            record["source"].pop("fileUrl", None)
        else:
            response = None
            for attempt in range(3):
                try:
                    response = session.get(file_url, timeout=30)
                    response.raise_for_status()
                    break
                except Exception:
                    if attempt == 2:
                        raise
            assert response is not None
            response_content = response.content
            content_type = response.headers.get("content-type", "")
        if "svg" in content_type or response_content.lstrip().startswith(b"<svg"):
            path = output_dir / "icon.svg"
            (output_dir / "icon.png").unlink(missing_ok=True)
            path.write_bytes(response_content)
            width = height = 512
            mime = "image/svg+xml"
        else:
            (output_dir / "icon.svg").unlink(missing_ok=True)
            with Image.open(BytesIO(response_content)) as opened:
                image = opened.convert("RGBA")
                alpha_box = image.getchannel("A").getbbox()
                if alpha_box:
                    image = image.crop(alpha_box)
                scale = min(400 / max(1, image.width), 400 / max(1, image.height))
                image = image.resize(
                    (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                    Image.Resampling.LANCZOS,
                )
                canvas = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
                canvas.alpha_composite(image, ((512 - image.width) // 2, (512 - image.height) // 2))
                path = output_dir / "icon.png"
                canvas.save(path, optimize=True)
            width = height = 512
            mime = "image/png"
        record["variants"]["square"] = {
            "path": path.relative_to(ROOT / "public").as_posix(),
            "sha256": hash_file(path),
            "width": width,
            "height": height,
            "mime": mime,
        }
        record["status"] = "candidate"
    except Exception as error:
        existing = next(iter(sorted(output_dir.glob("icon.*"))), None)
        if existing:
            if existing.suffix == ".svg":
                width = height = 512
            else:
                with Image.open(existing) as opened:
                    width, height = opened.width, opened.height
            record["variants"]["square"] = {
                "path": existing.relative_to(ROOT / "public").as_posix(),
                "sha256": hash_file(existing),
                "width": width,
                "height": height,
                "mime": "image/svg+xml" if existing.suffix == ".svg" else "image/png",
            }
            record["status"] = "candidate"
            record["statusReason"] = f"Remote refresh failed; retained frozen local file: {type(error).__name__}"
        else:
            record["statusReason"] = f"Acquisition failed: {type(error).__name__}: {error}"
    return record


def main():
    session = requests.Session()
    session.headers["User-Agent"] = "remotion-md/0.1.11 identity-asset-resolver"
    records = []
    for index, spec in enumerate(SPECS, 1):
        print(f"[{index}/{len(SPECS)}] {spec[2]}")
        records.append(acquire(spec, session))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "manifest.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    TS_PATH.write_text(
        '// Generated by scripts/acquire_identity_icons.py.\nimport type { MediaAssetDefinition } from "./types.ts";\n\n'
        + f"export const identityAssets = {json.dumps(records, ensure_ascii=False, indent=2)} as const satisfies readonly MediaAssetDefinition[];\n\n"
        + "export type IdentityAssetId = (typeof identityAssets)[number][\"id\"];\n"
        + "export const identityAssetById = new Map(identityAssets.map((asset) => [asset.id, asset]));\n",
        encoding="utf8",
    )
    print(json.dumps({status: sum(1 for record in records if record["status"] == status) for status in {record["status"] for record in records}}))


if __name__ == "__main__":
    main()
