#!/usr/bin/env python3
"""Inventory CMS-referenced media URLs without downloading assets."""
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
import json

ROOT = Path(__file__).resolve().parents[1]
CMS = ROOT / "app" / "cms-reference"
INPUTS = [
    "projects-production.json",
    "media-production.json",
    "metadata-production.json",
    "contact-production.json",
    "about-production.json",
]
records = {}


def add_url(url, source, mime=None, size=None):
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http") or not parsed.netloc:
        return
    item = records.setdefault(url, {
        "url": url,
        "host": parsed.netloc,
        "isGcsMedia": parsed.netloc == "storage.googleapis.com"
            and parsed.path.startswith("/activetheory-v6.appspot.com/media/"),
        "mimeType": mime,
        "declaredBytes": size,
        "sources": set(),
        "references": 0,
    })
    item["sources"].add(source)
    item["references"] += 1
    if item["mimeType"] is None and mime:
        item["mimeType"] = mime
    if item["declaredBytes"] is None and isinstance(size, (int, float)):
        item["declaredBytes"] = size


def walk(value, source, location="$"):
    if isinstance(value, dict):
        mime = value.get("mimeType")
        size = value.get("filesize")
        for key, child in value.items():
            if isinstance(child, str) and child.startswith(("https://", "http://")):
                # The parent file-size metadata applies only to the object's own URL.
                add_url(child, source, mime if key == "url" else None,
                        size if key == "url" else None)
            walk(child, source, f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk(child, source, f"{location}[{index}]")


for filename in INPUTS:
    path = CMS / filename
    if not path.exists():
        raise SystemExit(f"Missing CMS input: {path}")
    walk(json.loads(path.read_text(encoding="utf-8")), filename)

hosts = Counter(item["host"] for item in records.values())
media = [item for item in records.values() if item["isGcsMedia"]]
types = Counter(item["mimeType"] or "[unknown]" for item in media)
known_sizes = [item["declaredBytes"] for item in media
               if isinstance(item["declaredBytes"], (int, float))]
print(f"All unique absolute URLs: {len(records)}")
print(f"Unique GCS media URLs: {len(media)}")
print(f"GCS media URLs with declared size: {len(known_sizes)}")
print(f"Sum of declared bytes for unique GCS media URLs with size data: {sum(known_sizes):,}")
print("\nHosts:")
for name, count in hosts.most_common():
    print(f"  {count:4}  {name}")
print("\nGCS media MIME types:")
for name, count in types.most_common():
    print(f"  {count:4}  {name}")
print("\nLargest GCS media URLs with size metadata:")
largest = sorted(
    (item for item in media
     if isinstance(item["declaredBytes"], (int, float))),
    key=lambda item: item["declaredBytes"], reverse=True
)
for item in largest[:25]:
    print(f"  {item['declaredBytes'] / 1024 / 1024:8.2f} MiB  "
          f"{item['mimeType'] or '[unknown]'}  {item['url']}")
