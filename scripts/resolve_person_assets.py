#!/usr/bin/env python3
"""Resolve openly licensed portrait candidates from Wikidata/Commons.

The script never treats a search result or an official biography page as a
redistribution grant. Only a Wikidata P18 file whose Commons metadata matches
the explicit license allowlist is downloaded. Every decision is persisted for
human review.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import time
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import quote

import cv2
import requests
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src/media-assets/people-catalog.json"
OUTPUT = ROOT / "public/media-assets/people"
MANIFEST = OUTPUT / "manifest.json"
ATTRIBUTION = OUTPUT / "ATTRIBUTION.md"
USER_AGENT = "remotion-md/0.1.11 person-asset-resolver (local editorial video workflow)"

ENTITY_OVERRIDES = {
    "andrew_ng": "Q2846695",
    "daniel_oday": "Q63981759",
    "paul_hudson": "Q67029500",
    "george_church": "Q3298995",
    "john_jumper": "Q89620738",
    "robert_langer": "Q669597",
}

MANUAL_UNRESOLVED = {
    "chris_gibson_recursion": "No unambiguous Wikidata identity for the Recursion CEO; use fallback until a user-supplied or manually verified source is registered.",
    "robert_davis_merck": "The common name resolves to unrelated people; use fallback until Merck provides a reusable verified portrait.",
}

LICENSES = {
    "Public domain": "public-domain",
    "CC0": "cc0-1.0",
    "CC BY 2.0": "cc-by-2.0",
    "CC BY 3.0": "cc-by-3.0",
    "CC BY 4.0": "cc-by-4.0",
    "CC BY-SA 2.0": "cc-by-sa-2.0",
    "CC BY-SA 3.0": "cc-by-sa-3.0",
    "CC BY-SA 4.0": "cc-by-sa-4.0",
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    value = str(value)
    value = html.unescape(re.sub(r"<[^>]+>", "", value))
    return re.sub(r"\s+", " ", value).strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9\u3400-\u9fff]", "", value.casefold())


def get_json(session: requests.Session, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    for attempt in range(7):
        response = session.get(url, params=params, timeout=30)
        if response.status_code != 429:
            response.raise_for_status()
            return response.json()
        time.sleep(min(30, 1.5 * (2**attempt)))
    response.raise_for_status()
    raise RuntimeError("unreachable")


def get_binary(session: requests.Session, url: str) -> bytes:
    for attempt in range(7):
        response = session.get(url, timeout=60)
        if response.status_code != 429:
            response.raise_for_status()
            return response.content
        time.sleep(min(30, 1.5 * (2**attempt)))
    response.raise_for_status()
    raise RuntimeError("unreachable")


def resolve_entity(session: requests.Session, person: dict[str, Any]) -> tuple[str | None, str]:
    if person["id"] in ENTITY_OVERRIDES:
        return ENTITY_OVERRIDES[person["id"]], "Manual Wikidata identity override verified against the catalog role"
    name = person["name"]
    languages = ["zh", "en"] if re.search(r"[\u3400-\u9fff]", name) else ["en", "zh"]
    candidates: list[dict[str, Any]] = []
    for language in languages:
        data = get_json(
            session,
            "https://www.wikidata.org/w/api.php",
            {
                "action": "wbsearchentities",
                "search": name,
                "language": language,
                "uselang": language,
                "format": "json",
                "limit": 6,
                "type": "item",
            },
        )
        candidates.extend(data.get("search", []))
        exact = [c for c in candidates if normalize_name(c.get("label", "")) == normalize_name(name)]
        if exact:
            ids = list(dict.fromkeys(c["id"] for c in exact))
            entities = get_json(
                session,
                "https://www.wikidata.org/w/api.php",
                {"action": "wbgetentities", "ids": "|".join(ids), "props": "claims", "format": "json"},
            ).get("entities", {})
            def score(candidate: dict[str, Any]) -> tuple[int, int]:
                claims = entities.get(candidate["id"], {}).get("claims", {})
                is_human = any(
                    claim.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id") == "Q5"
                    for claim in claims.get("P31", [])
                )
                return (int(is_human) * 2 + int(bool(claims.get("P18"))) * 4, -ids.index(candidate["id"]))
            best = max(exact, key=score)
            return best["id"], clean(best.get("description"))
    return None, "No exact Wikidata label match"


def commons_metadata(session: requests.Session, filename: str) -> dict[str, Any] | None:
    data = get_json(
        session,
        "https://commons.wikimedia.org/w/api.php",
        {
            "action": "query",
            "format": "json",
            "prop": "imageinfo",
            "titles": f"File:{filename}",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 1600,
        },
    )
    page = next(iter(data.get("query", {}).get("pages", {}).values()), {})
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        return None
    meta = {key: clean(value.get("value")) for key, value in info.get("extmetadata", {}).items()}
    short = meta.get("LicenseShortName", "")
    license_id = next((mapped for label, mapped in LICENSES.items() if short == label or short.startswith(label)), None)
    return {"info": info, "meta": meta, "licenseId": license_id, "licenseShortName": short}


def focal_point(image: Image.Image) -> tuple[float, float, str]:
    rgb = cv2.cvtColor(__import__("numpy").array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces):
        x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
        return (x + w / 2) / image.width, (y + h * 0.42) / image.height, "face-detection"
    return 0.5, 0.42, "center"


def crop_at(image: Image.Image, size: tuple[int, int], focal: tuple[float, float]) -> Image.Image:
    target_ratio = size[0] / size[1]
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_h = image.height
        crop_w = round(crop_h * target_ratio)
    else:
        crop_w = image.width
        crop_h = round(crop_w / target_ratio)
    cx, cy = focal[0] * image.width, focal[1] * image.height
    left = max(0, min(image.width - crop_w, round(cx - crop_w / 2)))
    top = max(0, min(image.height - crop_h, round(cy - crop_h * 0.38)))
    return image.crop((left, top, left + crop_w, top + crop_h)).resize(size, Image.Resampling.LANCZOS)


def save_variant(image: Image.Image, path: Path, mode: str) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    if mode == "circle":
        rgba = image.convert("RGBA")
        mask = Image.new("L", rgba.size, 0)
        ImageDraw.Draw(mask).ellipse((2, 2, rgba.width - 2, rgba.height - 2), fill=255)
        rgba.putalpha(mask)
        rgba.save(path, optimize=True)
    else:
        image.convert("RGB").save(path, quality=91, optimize=True, progressive=True)
    with Image.open(path) as result:
        return {
            "path": path.relative_to(ROOT / "public").as_posix(),
            "sha256": sha256(path),
            "width": result.width,
            "height": result.height,
            "mime": Image.MIME.get(result.format, "image/jpeg"),
        }


def generate_variants(original_path: Path, asset_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    with Image.open(original_path) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
    fx, fy, method = focal_point(image)
    square = crop_at(image, (640, 640), (fx, fy))
    card = crop_at(image, (640, 800), (fx, fy))
    mono = ImageOps.grayscale(square).convert("RGB")
    light = ImageEnhance.Brightness(square).enhance(1.07)
    dark = ImageEnhance.Brightness(ImageEnhance.Contrast(square).enhance(1.05)).enhance(0.82)
    variants = {
        "original": {
            "path": original_path.relative_to(ROOT / "public").as_posix(),
            "sha256": sha256(original_path),
            "width": image.width,
            "height": image.height,
            "mime": Image.MIME.get(Image.open(original_path).format, "image/jpeg"),
        },
        "square": save_variant(square, asset_dir / "square.jpg", "jpg"),
        "circle": save_variant(crop_at(image, (512, 512), (fx, fy)), asset_dir / "circle.png", "circle"),
        "card": save_variant(card, asset_dir / "card.jpg", "jpg"),
        "monochrome": save_variant(mono, asset_dir / "monochrome.jpg", "jpg"),
        "light": save_variant(light, asset_dir / "light.jpg", "jpg"),
        "dark": save_variant(dark, asset_dir / "dark.jpg", "jpg"),
    }
    return variants, {"x": round(fx, 4), "y": round(fy, 4), "method": method}


def monogram(name: str) -> str:
    parts = re.findall(r"[A-Za-z]+|[\u3400-\u9fff]", name)
    if re.search(r"[\u3400-\u9fff]", name):
        return "".join(re.findall(r"[\u3400-\u9fff]", name))
    return "".join(part[0] for part in parts[:2]).upper() or "?"


def resolve(person: dict[str, Any], session: requests.Session, refresh: bool) -> dict[str, Any]:
    asset_dir = OUTPUT / person["id"]
    record: dict[str, Any] = {
        "id": person["id"],
        "kind": "person",
        "label": person["name"],
        "aliases": person.get("aliases", []),
        "status": "planned",
        "focalPoint": {"x": 0.5, "y": 0.42, "method": "center"},
        "variants": {},
        "fallback": {"type": "monogram", "value": monogram(person["name"])},
        "usage": {
            "attributionRequired": False,
            "redistribution": "unknown",
            "note": "No verified local portrait; render the deterministic monogram fallback.",
        },
        "catalog": {"roles": person["roles"], "categories": person["categories"], "priorities": person["priorities"]},
    }
    if person["id"] in MANUAL_UNRESOLVED:
        record["statusReason"] = MANUAL_UNRESOLVED[person["id"]]
        return record
    try:
        qid, description = resolve_entity(session, person)
        record["identity"] = {"wikidataId": qid, "description": description}
        if not qid:
            record["statusReason"] = description
            return record
        entity = get_json(session, f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json")["entities"][qid]
        claims = entity.get("claims", {}).get("P18", [])
        if not claims:
            record["statusReason"] = "Exact Wikidata person has no P18 portrait"
            return record
        filename = claims[0]["mainsnak"]["datavalue"]["value"]
        metadata = commons_metadata(session, filename)
        if not metadata or not metadata["licenseId"]:
            record["status"] = "blocked"
            record["statusReason"] = f"Commons license not allowlisted: {(metadata or {}).get('licenseShortName', 'missing metadata')}"
            return record
        info, meta = metadata["info"], metadata["meta"]
        author = meta.get("Artist") or meta.get("Credit")
        if metadata["licenseId"] != "public-domain" and not author:
            record["status"] = "blocked"
            record["statusReason"] = "Attribution license has no usable author metadata"
            return record
        asset_dir.mkdir(parents=True, exist_ok=True)
        original_path = asset_dir / "original.jpg"
        if refresh or not original_path.exists():
            image_url = info.get("thumburl") or info["url"]
            with Image.open(BytesIO(get_binary(session, image_url))) as downloaded:
                ImageOps.exif_transpose(downloaded).convert("RGB").save(original_path, quality=94, optimize=True)
        variants, focal = generate_variants(original_path, asset_dir)
        license_id = metadata["licenseId"]
        record.update(
            {
                "status": "candidate",
                "focalPoint": focal,
                "variants": variants,
                "source": {
                    "pageUrl": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{quote(filename)}",
                    "fileUrl": info.get("thumburl") or info["url"],
                    "provider": "Wikimedia Commons via Wikidata P18",
                    "author": author or "Public-domain source; see file page",
                    "license": license_id,
                    "licenseUrl": meta.get("LicenseUrl") or None,
                    "attribution": f"{author or 'Public-domain source'} — {metadata['licenseShortName']} — Wikimedia Commons",
                    "accessedAt": date.today().isoformat(),
                },
                "usage": {
                    "attributionRequired": license_id != "public-domain",
                    "redistribution": "allowed",
                    "note": "Open-license candidate. Human identity/crop review is still required; personality and trademark rights may apply.",
                },
            }
        )
    except Exception as error:  # keep the catalog usable when one source fails
        record["statusReason"] = f"Resolver error: {type(error).__name__}: {error}"
    return record


def write_outputs(records: list[dict[str, Any]]) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    lines = [
        "# Person asset attribution",
        "",
        "Generated from Wikidata P18 and Wikimedia Commons metadata. Candidate status does not replace human rights review.",
        "",
        "| Person | License | Author / attribution | Source |",
        "|---|---|---|---|",
    ]
    for record in records:
        source = record.get("source")
        if not source:
            continue
        author = (source.get("attribution") or "").replace("|", "\\|")
        lines.append(f"| {record['label']} | {source['license']} | {author} | [Commons file]({source['pageUrl']}) |")
    ATTRIBUTION.write_text("\n".join(lines) + "\n", encoding="utf8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--priority", choices=["P0", "P1", "all"], default="P0")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retry-errors-only", action="store_true")
    parser.add_argument("--ids", help="Comma-separated catalog IDs to resolve")
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding="utf8"))
    previous = {entry["id"]: entry for entry in json.loads(MANIFEST.read_text(encoding="utf8"))} if MANIFEST.exists() else {}
    selected = [p for p in catalog if args.priority == "all" or args.priority in p["priorities"]]
    if args.ids:
        requested = set(args.ids.split(","))
        selected = [p for p in selected if p["id"] in requested]
    if args.limit:
        selected = selected[: args.limit]
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    for index, person in enumerate(selected, 1):
        if not args.refresh and previous.get(person["id"], {}).get("status") in {"candidate", "approved"}:
            print(f"[{index}/{len(selected)}] {person['name']} (cached)", flush=True)
            continue
        if args.retry_errors_only and not previous.get(person["id"], {}).get("statusReason", "").startswith("Resolver error:"):
            continue
        print(f"[{index}/{len(selected)}] {person['name']}", flush=True)
        previous[person["id"]] = resolve(person, session, args.refresh)
        if index % 10 == 0:
            write_outputs([previous.get(p["id"], resolve_placeholder(p)) for p in catalog])
        time.sleep(0.65)
    records = [previous.get(p["id"], resolve_placeholder(p)) for p in catalog]
    write_outputs(records)
    counts: dict[str, int] = {}
    for record in records:
        counts[record["status"]] = counts.get(record["status"], 0) + 1
    print(json.dumps(counts, ensure_ascii=False))


def resolve_placeholder(person: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": person["id"],
        "kind": "person",
        "label": person["name"],
        "aliases": person.get("aliases", []),
        "status": "planned",
        "focalPoint": {"x": 0.5, "y": 0.42, "method": "center"},
        "variants": {},
        "fallback": {"type": "monogram", "value": monogram(person["name"])},
        "usage": {
            "attributionRequired": False,
            "redistribution": "unknown",
            "note": "Not resolved yet; use monogram fallback.",
        },
        "catalog": {"roles": person["roles"], "categories": person["categories"], "priorities": person["priorities"]},
    }


if __name__ == "__main__":
    main()
