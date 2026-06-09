#!/usr/bin/env python3
"""Generate js/locations.js from LocationDataWeHo.csv."""

import csv
import json
import os
import re
import sys

CSV_PATH = os.environ.get(
    "ROUTE66_CSV",
    os.path.expanduser("~/Documents/Route66Photos/LocationDataWeHo.csv"),
)
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "js", "locations.js")


def slugify(name: str) -> str:
    s = name.lower().replace("&", "and")
    s = re.sub(r"[''`’]s\b", "", s)
    s = re.sub(r"[''`’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def parse_year(value, is_close=False):
    if not value or not str(value).strip():
        return None
    v = str(value).strip()
    if v.lower() == "present":
        return 2026 if is_close else None
    match = re.search(r"(19|20)\d{2}", v)
    return int(match.group()) if match else None


def infer_type(name, tags, tags2):
    combined = f"{tags} {tags2} {name}".lower()
    if any(
        token in combined
        for token in (
            "bookstore",
            "archives",
            "institute",
            "tide offices",
            "scwu",
            "connexxus",
            "lgbt center",
        )
    ):
        return "nonprofit"
    if "hotel" in name.lower() or "garden of allah" in name.lower():
        return "hotel"
    if any(token in name.lower() for token in ("cafe", "bakery", "drip", "salon", "marix", "basix", "market")):
        return "cafe"
    if any(
        token in name.lower()
        for token in ("bar", "club", "room", "peanuts", "chapel", "abbey", "sweetwater", "hi tops", "rocco")
    ):
        return "bar"
    return "misc"


def clean_text(value: str) -> str:
    if not value:
        return ""
    return str(value).replace("\u200b", "").strip()


def photo_basename(path):
    if not path or not str(path).strip():
        return None
    return os.path.basename(str(path).strip())


RELOCATION_PATTERN = re.compile(r"\((second location|location 2)\)", re.IGNORECASE)


def parse_relocation(name: str):
    match = RELOCATION_PATTERN.search(name)
    if not match:
        return {
            "isRelocation": False,
            "organizationName": name,
            "locationLabel": None,
        }

    organization_name = RELOCATION_PATTERN.sub("", name).strip()
    label = match.group(1).strip().title()
    if label == "Location 2":
        label = "Relocated"
    return {
        "isRelocation": True,
        "organizationName": organization_name,
        "locationLabel": label,
    }


def detail_page_for(slug: str) -> str | None:
    if slug == "the-palms-bar":
        return "palms-bar-detail.html"
    return None


def build_locations(rows):
    seen_slugs = {}
    locations = []

    for row in rows:
        name = clean_text(row["Name"])
        base_slug = slugify(name)
        slug = base_slug
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{base_slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        open_year = parse_year(row["Opening Date"], False)
        close_year = parse_year(row["Closing Date"], True)
        if open_year is None:
            open_year = 0
        if close_year is None:
            close_year = 2026

        tags = clean_text(row.get("Tags") or "")
        tags2 = clean_text(row.get("Tags 2") or "")

        relocation = parse_relocation(name)

        loc = {
            "id": slug,
            "name": name,
            "organizationName": relocation["organizationName"],
            "isRelocation": relocation["isRelocation"],
            "locationLabel": relocation["locationLabel"],
            "address": clean_text(row["Address"]),
            "lat": float(row["Latitude"]),
            "lng": float(row["Longitude"]),
            "open": open_year,
            "close": close_year,
            "type": infer_type(name, tags, tags2),
            "desc": clean_text(row.get("Short Description") or row.get("Description") or ""),
            "description": clean_text(row.get("Description") or ""),
            "shortDescription": clean_text(row.get("Short Description") or ""),
            "tags": clean_text(row.get("Tags") or ""),
            "tags2": clean_text(row.get("Tags 2") or ""),
            "sources": clean_text(row.get("Sources") or ""),
            "distanceMiles": float(row["Approximate Distance in Miles"])
            if row.get("Approximate Distance in Miles")
            else None,
            "detailPage": detail_page_for(slug),
            "photos": [],
        }

        for index in range(1, 4):
            photo = photo_basename(row.get(f"Photograph {index}"))
            caption = clean_text(row.get(f"Photograph Caption {index}") or "")
            if photo:
                loc["photos"].append({"file": photo, "caption": caption})

        locations.append(loc)

    return locations


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else CSV_PATH
    out_path = sys.argv[2] if len(sys.argv) > 2 else OUT_PATH

    with open(csv_path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    locations = build_locations(rows)
    js = "window.ROUTE66_LOCATIONS = " + json.dumps(locations, indent=4, ensure_ascii=False) + ";\n"

    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(js)

    print(f"Wrote {len(locations)} locations to {out_path}")


if __name__ == "__main__":
    main()
