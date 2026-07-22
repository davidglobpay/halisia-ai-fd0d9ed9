This request is large. I'll ship it in four focused waves so each one is verifiable before the next. All work stays inside existing routes; no new business-logic backends beyond the interactive layers already fed by `geotech.functions.ts`, `location-intel.functions.ts`, and `wave4-overlays.functions.ts`.

## Wave A — Interactive Soil Profile & Foundation Comparison

File: `src/components/halisia/geotech-panel.tsx` (+ small helpers in `src/lib/geotech-derive.ts`)

- Layer toggles (Clay / Sand / Silt / Organic / Bulk density) with a legend swatch bar; toggling filters the SVG cross-section and the data table.
- Derived metrics per depth: **bearing capacity** (kPa band from texture + bulk density), **shrink–swell potential** (from clay % + organic %), **rock depth** (from existing bedrock estimate), **groundwater probability** (from existing gw block). Rendered as an inline "Subsurface indicators" strip with tooltips explaining each formula.
- Foundation suitability comparison: replace the flat list with 4 side-by-side cards (Strip / Pad / Raft / Pile). Each card shows suitability chip, best-use blurb, and a 3-bar mini-score (Load capacity / Cost / Site fit) so users can compare at a glance.

## Wave B — Map Overlays & Tools

Files: `src/components/halisia/leaflet-layers-map.internal.tsx` (+ new `src/lib/map-tools.ts`)

- Toolbar (top-right, glassy) with: **Heatmap toggle** (already have `HeatmapMap` — reuse the density source), **Property boundaries** (OSM `way[boundary]` via existing overlay function), **Distance tool**, **Area tool**, **Elevation profile**, **Draw polygon/line**, **Export GeoJSON**.
- Distance/area use `leaflet` polyline/polygon with live tooltip (Haversine + shoelace on lat/lng).
- Elevation profile: sample 40 points along the drawn line via `terrain-grid.ts` (already cached), render inline sparkline with min/max/gain/loss.
- Export button downloads the drawn features as `.geojson`.
- All tools are additive; the existing tile-provider switcher stays untouched.

## Wave C — Construction Risks with Mitigation & Cost Impact

Files: `src/lib/geotech.functions.ts` (extend `RiskIndicator`), `src/components/halisia/geotech-panel.tsx`, `src/components/halisia/intelligence-dashboard.tsx` (risks tab surface).

- Add `mitigation: string` and `costImpact: { band: "Low"|"Moderate"|"High"|"Severe"; rangeKESPerSqm: [number, number]; note: string }` to each risk item.
- Deterministic rule table (e.g. expansive clay → "Ground beam + non-expansive backfill", KES 3,500–6,500/m²).
- Render as expandable risk cards: severity chip, one-line summary, "What to do" list, cost-impact bar with KES/m² band.

## Wave D — Amenities Caching & Graceful Fallbacks

Files: `src/lib/location-intel.functions.ts`, `src/components/halisia/place-card.tsx`.

- In-memory LRU (module-scope Map, 15-min TTL) for `getPlaceDetails`, place photos, and route-matrix results, keyed by place id + origin.
- Per-request `Promise.allSettled` on Routes / Details / Photos so a single provider failure never blanks the card.
- Skeleton + `role="status"` while loading; on error, show "Live data unavailable — cached snapshot" and keep static fields (name, address, rating baseline) visible.
- Retry button on the card that re-triggers only the failed sub-fetch.

## Wave E — End-to-End Verification

File: new `tests/e2e/amenities-and-maps.spec.ts` + extend `wave2-terrain.spec.ts`.

- Amenities (desktop 1280×800 and mobile 390×844 projects already in `playwright.config.ts`): assert first `PlaceCard` shows a distance in km/m, a driving-time badge, an open/closed pill; expand → photos strip has ≥1 `<img>` with non-empty `src`, reviews list renders or shows the graceful fallback message.
- Map tools: activate distance tool → click twice → tooltip reads `/\d+(\.\d+)?\s?(m|km)/`; activate area tool → close polygon → tooltip reads `/\d+(\.\d+)?\s?(m²|ha)/`; click Export → download `.geojson` filename check.
- Geotech: toggle a layer off → the corresponding legend swatch dims and its column disappears from the table; foundation cards render 4 items.

## Technical notes (skip if non-technical)

- No new deps required — Leaflet already ships with `L.Polyline`/`L.Polygon` helpers; sparkline is a lightweight inline SVG.
- Cache lives on the server-function module (per-worker), acceptable for a 15-min window; no persistence needed.
- Cost bands are indicative KES ranges based on published EAK/NCA rate-of-works references; each card carries a "planning-only" caveat consistent with the existing geotech disclaimer.
- Total: ~6 file edits + 2 new files + 1 new spec. Estimated ~1200 LOC net add.

Ready to build A → E in order once you approve.
