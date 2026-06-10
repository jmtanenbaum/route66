# Route 66 Map — Project Plan

Digital map and archive for **Discovering West Hollywood's Route 66 — Lesbian Historical Places Digital Map** (June L. Mazer Lesbian Archives).

## Build order recommendation

**Detail pages first, then Leaflet** — but validate with one end-to-end slice before scaling both.

### Why detail pages come first

- `locations.js` already has all fields the map popup and detail pages need.
- The map popup's "Read more" button requires a `detailPage` URL for each location.
- One template (Palms) scales to all 30 locations via the build script.
- Lower risk: content and CSV data can be reviewed page-by-page before map complexity.

### Why not wait on Leaflet entirely

Leaflet work will surface issues detail pages alone won't:

- Overlapping coordinates (e.g. Abbey and Chapel share lat/lng)
- Bounds/zoom for 30 pins across West Hollywood
- Timeline filtering: location is active when `open ≤ year ≤ close` (present = 2026)
- Mobile popup UX

---

## Phases

### Phase 0 — Shared data contract

Both map and detail pages read from the same `locations.js` entry:

| Field | Map popup | Detail page |
|-------|-----------|-------------|
| `name` | ✓ | ✓ |
| `address` | ✓ | ✓ |
| `open` / `close` | ✓ | ✓ |
| `photos[0]` | thumbnail | carousel |
| `shortDescription` / `desc` | popup text | — |
| `description` | — | full essay |
| `tags` / `tags2` | filter checkboxes | category chips |
| `detailPage` | Read more href | — |

### Phase 1 — Detail page template + generator *(complete)*

1. Refine Palms as the canonical template
2. Add HTML template + generation to `scripts/build-locations.py`
3. Generate all 30 pages and set `detailPage` on every location
4. Spot-check edge cases: no photo, relocation entry, overlapping coords

**Output:** Search, nav, and map "Read more" all have real destinations.

**Convention:** Each location page is named `{slug}-detail.html` (e.g. `the-palms-bar-detail.html`). Regenerate after CSV edits with `python3 scripts/build-locations.py`.

### Phase 2 — Leaflet map (replace static image)

1. Swap static map for Leaflet + tile layer
2. `fitBounds()` to all markers on load
3. Marker per location → popup with spreadsheet fields
4. "Read more" → `loc.detailPage`
5. Hook sidebar search and timeline slider to marker visibility

### Phase 3 — Filters + polish

1. **Tag filters** from CSV `Tags` / `Tags 2`: unique values, checkbox UI
2. **Timeline slider**: show location if `open ≤ year ≤ close`
3. **Mobile**: bottom sheet or panel instead of tiny Leaflet popup
4. **Clustering/offset** for duplicate coordinates

---

## Map requirements (from notes)

- Base map zoomed to show all locations
- Filters by column O tags — check/uncheck
- Pin per location
- Popup per location: Name, Address, Opening–Closing dates, photo 1 thumbnail (when available), short description, Read more button
- Timeline slider based on opening/closing dates (present = 2026)
- Responsive website and map on mobile
- Read more → detail page with same site navigation

---

## Current codebase

| File | Role |
|------|------|
| `js/locations.js` | Source of truth (generated from CSV) |
| `scripts/build-locations.py` | Regenerates data + detail pages |
| `templates/location-detail.html` | Detail page template |
| `*-detail.html` | Generated location pages (30 total) |
| `js/map-view.js` | Static map pins, popup, search (Leaflet replacement in Phase 2) |
| `js/site-nav.js` | Mobile nav + sticky header |
| `js/site-search.js` | Global location search modal |

## Regenerating from CSV

```bash
python3 scripts/build-locations.py
```

This also copies referenced photos from `~/Documents/Route66Photos/` into `assets/photos/`.

Optional CSV path:

```bash
ROUTE66_CSV=/path/to/LocationDataWeHo.csv python3 scripts/build-locations.py
```
