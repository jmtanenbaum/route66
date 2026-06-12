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

### Phase 2 — Leaflet map (replace static image) *(steps 1–6 complete)*

1. Swap static map for Leaflet + tile layer
2. `fitBounds()` to all markers on load
3. Marker per location → popup with spreadsheet fields
4. "Read more" → `loc.detailPage`
5. Hook sidebar search and timeline slider to marker visibility

#### Phase 2 implementation steps

Use a **thin vertical slice** first: real map + all pins + existing HTML popup, then layer filters/timeline polish.

**Step 1 — Add Leaflet + [leaflet-providers](https://github.com/leaflet-extras/leaflet-providers)**

- Leaflet CSS/JS on `restored-hero-layout.html`
- `leaflet-providers.js` for tile layers
- Replace static map `<img>` with `<div id="leaflet-map">`
- Keep sidebar, search, year slider, and `#location-popup` unchanged

**Recommended starter tiles** (free, no API key via leaflet-providers):

| Provider | Notes |
|----------|-------|
| `CartoDB.Positron` | Clean light basemap — default choice |
| `OpenStreetMap.Mapnik` | Simple OSM default |
| `CartoDB.Voyager` | More street detail |

```javascript
L.tileLayer.provider("CartoDB.Positron").addTo(map);
```

**Step 2 — Initialize bounds**

```javascript
const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
```

**Step 3 — Markers → existing popup**

- Use `L.layerGroup()` for markers
- Marker click calls existing `showPopup(loc)` (not Leaflet's default popup)
- Reuse `#location-popup` panel for photo, dates, short description, Read more

**Step 4 — Reconnect timeline + sidebar search** *(done)*

- Filter markers when `loc.open <= year <= loc.close`
- Filter markers by map sidebar search query
- Update `Route66Map.showLocation(id)` to `flyTo` + popup

**Step 5 — Overlapping pins** *(done)*

- Spread markers in a small ring when locations share coordinates (Abbey/Chapel, Mazer/ONE)

**Step 6 — Mobile + polish** *(done)*

- `map.invalidateSize()` on resize and when map section enters viewport
- Bottom-sheet popup layout on small screens

#### File structure

| File | Role |
|------|------|
| `js/leaflet-map.js` | Map init, tiles, bounds, marker layer |
| `js/map-view.js` | Popup UI, timeline, search, `Route66Map` API |

**Day 1 checklist:** Steps 1–3 complete → verify Palms + Abbey pin → popup → detail page.

### Phase 3 — Filters + polish *(complete)*

1. **Tag filters** from CSV `Tags` / `Tags 2`: toggle pills, built from `locations.js` *(done)*
2. **Timeline slider**: show location if `open ≤ year ≤ close` *(done — Phase 2)*
3. **Mobile**: bottom sheet popup on small screens *(done — Phase 2)*
4. **Clustering/offset** for duplicate coordinates *(done — Phase 2)*

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
| `js/leaflet-map.js` | Leaflet init, tiles, marker layer |
| `js/map-view.js` | Popup UI, timeline, search, `Route66Map` API |
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
