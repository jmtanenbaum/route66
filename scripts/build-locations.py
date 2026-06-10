#!/usr/bin/env python3
"""Generate js/locations.js and location detail pages from LocationDataWeHo.csv."""

import csv
import hashlib
import html
import json
import os
import re
import shutil
import sys

ROOT_DIR = os.path.join(os.path.dirname(__file__), "..")
CSV_PATH = os.environ.get(
    "ROUTE66_CSV",
    os.path.expanduser("~/Documents/Route66Photos/LocationDataWeHo.csv"),
)
OUT_PATH = os.path.join(ROOT_DIR, "js", "locations.js")
TEMPLATE_PATH = os.path.join(ROOT_DIR, "templates", "location-detail.html")
DETAIL_PAGES_DIR = ROOT_DIR
PHOTOS_SRC = os.environ.get(
    "ROUTE66_PHOTOS",
    os.path.expanduser("~/Documents/Route66Photos"),
)
PHOTOS_DEST = os.path.join(ROOT_DIR, "assets", "photos")
VALIDATION_CSV = os.environ.get(
    "ROUTE66_VALIDATION_CSV",
    os.path.expanduser("~/Documents/Route66Photos/Route 66 Data - Locations_to_validate_validation.csv"),
)

PLACEHOLDER_IMAGE = (
    "data:image/svg+xml;base64,"
    "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAi"
    "IGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgcng9Ijgi"
    "IGZpbGw9IiNlOGVhZWQiLz48cGF0aCBkPSJNMTcwIDEzMCBsMzAgNDAgbDIwLTE1IGw0"
    "MCA1NSBIMTQweiIgZmlsbD0iI2JkYzFjNiIvPjxjaXJjbGUgY3g9IjI1MCIgY3k9IjEyMCI"
    "gcj0iMTgiIGZpbGw9IiNiZGMxYzYiLz48L3N2Zz4="
)


def slugify(name: str) -> str:
    s = name.lower().replace("&", "and")
    s = re.sub(r"[''`’]s\b", "", s)
    s = re.sub(r"[''`’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def parse_year(value, is_close=False):
    if not value or not str(value).strip():
        return None
    v = re.sub(r"(?i)^circa\.?\s*", "", str(value).strip())
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


def detail_page_for(slug: str) -> str:
    return f"{slug}-detail.html"


def format_census_address(census: str) -> str:
    parts = [part.strip() for part in census.split(",") if part.strip()]
    if len(parts) < 4:
        return census.title()
    street = parts[0].title().replace("Blvd", "Blvd").replace(" Blvd", " Blvd")
    city = parts[1].title()
    state = parts[2].upper()
    zip_code = parts[3]
    return f"{street}, {city}, {state} {zip_code}"


def load_address_enrichments() -> dict[str, str]:
    if not os.path.isfile(VALIDATION_CSV):
        return {}

    enrichments = {}
    with open(VALIDATION_CSV, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            name = clean_text(row.get("Name") or "")
            census = clean_text(row.get("Census_Matched_Address") or "")
            if name and census:
                enrichments[name] = format_census_address(census)
    return enrichments


def resolve_address(name: str, address: str, enrichments: dict[str, str]) -> str:
    address = clean_text(address)
    if "," in address:
        return address
    return enrichments.get(name, address)


def format_dates(open_year: int, close_year: int, open_label: str = "", close_label: str = "") -> str:
    if open_label and close_label:
        return f"{open_label} - {close_label}"
    if open_year and close_year:
        close_display = "Present" if close_year == 2026 else str(close_year)
        return f"{open_year} - {close_display}"
    if open_year:
        return str(open_year)
    if close_year and close_year != 2026:
        return f"Until {close_year}"
    return "Dates unknown"


def render_description(description: str) -> str:
    text = clean_text(description)
    if not text:
        return "<p>Description forthcoming.</p>"

    parts = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(parts) == 1 and "\n" in parts[0]:
        parts = [part.strip() for part in parts[0].split("\n") if part.strip()]

    return "".join(f"<p>{html.escape(part)}</p>" for part in parts)


def render_categories(tags: str, tags2: str) -> str:
    categories = [clean_text(value) for value in (tags, tags2) if clean_text(value)]
    if not categories:
        return (
            '<span class="px-4 py-2 bg-surface-container text-on-surface-variant '
            'font-ui-main text-ui-main text-sm rounded-full border border-outline-variant">'
            "Uncategorized</span>"
        )

    chip = (
        '<span class="px-4 py-2 bg-primary-fixed text-on-primary-fixed font-ui-main '
        'text-ui-main text-sm rounded-full border border-primary-fixed-dim">{label}</span>'
    )
    return "".join(chip.format(label=html.escape(category)) for category in categories)


def render_sources(sources: str) -> str:
    lines = [line.strip() for line in clean_text(sources).split("\n") if line.strip()]
    if not lines:
        return '<p class="font-ui-main text-ui-main text-on-surface-variant">Sources forthcoming.</p>'

    item = (
        '<li class="flex items-start space-x-2">'
        '<span class="material-symbols-outlined text-secondary text-sm mt-1" data-icon="book">book</span>'
        "<span>{text}</span></li>"
    )
    items = "".join(item.format(text=html.escape(line)) for line in lines)
    return f'<ul class="space-y-2 font-ui-main text-ui-main text-on-surface-variant">{items}</ul>'


def render_gallery(name: str, photos: list[dict]) -> tuple[str, str]:
    if not photos:
        gallery = (
            '<div class="bg-surface-container-lowest border border-outline-variant rounded-xl '
            'overflow-hidden shadow-sm">'
            '<div class="relative aspect-[16/9] md:aspect-[21/9] bg-surface-variant overflow-hidden '
            'flex items-center justify-center">'
            f'<img alt="{html.escape(name)}" class="h-full w-full object-cover opacity-80" '
            f'src="{PLACEHOLDER_IMAGE}">'
            '<div class="absolute inset-0 flex items-center justify-center bg-inverse-surface/20">'
            '<p class="font-label-caps text-label-caps uppercase tracking-widest text-on-surface">'
            "Photograph unavailable</p></div></div></div>"
        )
        return gallery, ""

    slides = []
    indicators = []
    for photo in photos:
        caption = photo.get("caption") or name
        slides.append(
            '<div class="min-w-full h-full flex items-center justify-center">'
            f'<img alt="{html.escape(caption)}" class="h-full w-auto object-contain" '
            f'src="assets/photos/{html.escape(photo["file"])}">'
            "</div>"
        )
        indicators.append(
            '<button type="button" class="carousel-indicator w-2 h-2 rounded-full '
            'bg-outline-variant transition-colors"></button>'
        )

    multi = len(photos) > 1
    controls_class = "" if multi else " hidden"
    indicators_class = "" if multi else " hidden"
    initial_caption = html.escape(photos[0].get("caption") or "")

    gallery = (
        '<div class="bg-surface-container-lowest border border-outline-variant rounded-xl '
        'overflow-hidden shadow-sm relative group">'
        '<div class="relative aspect-[16/9] md:aspect-[21/9] bg-surface-variant overflow-hidden">'
        f'<div class="flex transition-transform duration-500 h-full" id="carousel-track">{"".join(slides)}</div>'
        f'<button type="button" class="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-md '
        f'p-2 rounded-full text-primary hover:bg-primary hover:text-on-primary transition-all shadow-md z-10'
        f'{controls_class}" id="prev-btn">'
        '<span class="material-symbols-outlined">chevron_left</span></button>'
        f'<button type="button" class="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-md '
        f'p-2 rounded-full text-primary hover:bg-primary hover:text-on-primary transition-all shadow-md z-10'
        f'{controls_class}" id="next-btn">'
        '<span class="material-symbols-outlined">chevron_right</span></button>'
        f'<div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2{indicators_class}">'
        f'{"".join(indicators)}</div></div>'
        '<div class="p-4 bg-surface-container-lowest border-t border-outline-variant">'
        f'<p class="font-ui-main text-ui-main text-on-surface-variant italic" id="carousel-caption">'
        f"{initial_caption}</p></div></div>"
    )

    captions = [photo.get("caption") or "" for photo in photos]
    script = (
        "<script>\n"
        "    document.addEventListener('DOMContentLoaded', () => {\n"
        "        const track = document.getElementById('carousel-track');\n"
        "        const prevBtn = document.getElementById('prev-btn');\n"
        "        const nextBtn = document.getElementById('next-btn');\n"
        "        const indicators = document.querySelectorAll('.carousel-indicator');\n"
        "        const captionEl = document.getElementById('carousel-caption');\n"
        f"        const captions = {json.dumps(captions, ensure_ascii=False)};\n"
        "        let currentIndex = 0;\n"
        f"        const totalSlides = {len(photos)};\n\n"
        "        function updateCarousel() {\n"
        "            track.style.transform = `translateX(-${currentIndex * 100}%)`;\n"
        "            if (captionEl) captionEl.textContent = captions[currentIndex] || '';\n"
        "            indicators.forEach((ind, index) => {\n"
        "                if (index === currentIndex) {\n"
        "                    ind.classList.add('bg-primary');\n"
        "                    ind.classList.remove('bg-outline-variant');\n"
        "                } else {\n"
        "                    ind.classList.remove('bg-primary');\n"
        "                    ind.classList.add('bg-outline-variant');\n"
        "                }\n"
        "            });\n"
        "        }\n\n"
        "        if (totalSlides > 1 && prevBtn && nextBtn) {\n"
        "            prevBtn.addEventListener('click', () => {\n"
        "                currentIndex = (currentIndex > 0) ? currentIndex - 1 : totalSlides - 1;\n"
        "                updateCarousel();\n"
        "            });\n"
        "            nextBtn.addEventListener('click', () => {\n"
        "                currentIndex = (currentIndex < totalSlides - 1) ? currentIndex + 1 : 0;\n"
        "                updateCarousel();\n"
        "            });\n"
        "            indicators.forEach((ind, index) => {\n"
        "                ind.addEventListener('click', () => {\n"
        "                    currentIndex = index;\n"
        "                    updateCarousel();\n"
        "                });\n"
        "            });\n"
        "        }\n"
        "    });\n"
        "</script>"
    )
    return gallery, script


def render_detail_page(template: str, loc: dict, build_version: str) -> str:
    gallery, carousel_script = render_gallery(loc["name"], loc["photos"])
    page_title = html.escape(f"{loc['name']} — Queer Women's Route 66")

    replacements = {
        "{{PAGE_TITLE}}": page_title,
        "{{NAME}}": html.escape(loc["name"]),
        "{{ADDRESS}}": html.escape(loc["address"]),
        "{{DATES}}": html.escape(format_dates(loc["open"], loc["close"], loc["openLabel"], loc["closeLabel"])),
        "{{GALLERY}}": gallery,
        "{{DESCRIPTION}}": render_description(loc["description"]),
        "{{CATEGORIES}}": render_categories(loc["tags"], loc["tags2"]),
        "{{SOURCES}}": render_sources(loc["sources"]),
        "{{CAROUSEL_SCRIPT}}": carousel_script,
        "{{BUILD_VERSION}}": build_version,
    }

    page = template
    for key, value in replacements.items():
        page = page.replace(key, value)
    return page


def build_locations(rows, enrichments: dict[str, str]):
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

        open_label = clean_text(row["Opening Date"])
        close_label = clean_text(row["Closing Date"])
        open_year = parse_year(open_label, False)
        close_year = parse_year(close_label, True)
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
            "address": resolve_address(name, row["Address"], enrichments),
            "lat": float(row["Latitude"]),
            "lng": float(row["Longitude"]),
            "open": open_year,
            "close": close_year,
            "openLabel": open_label,
            "closeLabel": close_label,
            "type": infer_type(name, tags, tags2),
            "desc": clean_text(row.get("Short Description") or row.get("Description") or ""),
            "description": clean_text(row.get("Description") or ""),
            "shortDescription": clean_text(row.get("Short Description") or ""),
            "tags": tags,
            "tags2": tags2,
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


def write_detail_pages(locations, template: str, build_version: str):
    generated = []
    for loc in locations:
        filename = loc["detailPage"]
        path = os.path.join(DETAIL_PAGES_DIR, filename)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(render_detail_page(template, loc, build_version))
        generated.append(filename)
    return generated


SITE_PAGES = ("restored-hero-layout.html", "about.html")
LOCATIONS_SCRIPT_PATTERN = re.compile(r"js/locations\.js(?:\?v=[^\"']+)?")


def patch_site_pages(build_version: str):
    script_src = f"js/locations.js?v={build_version}"
    for filename in SITE_PAGES:
        path = os.path.join(ROOT_DIR, filename)
        with open(path, encoding="utf-8") as handle:
            content = handle.read()
        updated = LOCATIONS_SCRIPT_PATTERN.sub(script_src, content)
        if updated != content:
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(updated)


def sync_photos(locations):
    os.makedirs(PHOTOS_DEST, exist_ok=True)
    copied = 0
    missing = []

    for loc in locations:
        for photo in loc["photos"]:
            filename = photo["file"]
            src = os.path.join(PHOTOS_SRC, filename)
            dest = os.path.join(PHOTOS_DEST, filename)
            if not os.path.isfile(src):
                missing.append((loc["name"], filename))
                continue
            if not os.path.isfile(dest) or os.path.getmtime(src) > os.path.getmtime(dest):
                shutil.copy2(src, dest)
                copied += 1

    return copied, missing


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else CSV_PATH
    out_path = sys.argv[2] if len(sys.argv) > 2 else OUT_PATH

    with open(csv_path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    with open(TEMPLATE_PATH, encoding="utf-8") as handle:
        template = handle.read()

    enrichments = load_address_enrichments()
    locations = build_locations(rows, enrichments)
    copied, missing = sync_photos(locations)
    js = "window.ROUTE66_LOCATIONS = " + json.dumps(locations, indent=4, ensure_ascii=False) + ";\n"
    build_version = hashlib.md5(js.encode("utf-8")).hexdigest()[:8]

    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write(js)

    detail_pages = write_detail_pages(locations, template, build_version)
    patch_site_pages(build_version)

    print(f"Wrote {len(locations)} locations to {out_path}")
    print(f"Generated {len(detail_pages)} detail pages (cache version {build_version})")
    print(f"Synced {copied} photo(s) to {PHOTOS_DEST}")
    if missing:
        print(f"Warning: {len(missing)} missing photo(s) in {PHOTOS_SRC}:")
        for name, filename in missing:
            print(f"  - {name}: {filename}")


if __name__ == "__main__":
    main()
