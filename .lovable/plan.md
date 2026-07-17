This is a large, multi-surface change. I'll ship it in phases, all additive — no existing UX regressed.

## 1. Wave 4 map overlays + legend + toggles
- Extend `leaflet-layers-map.tsx` to accept optional overlays: **admin boundaries** (county / constituency / ward polylines from OSM Overpass `admin_level=4/6/7`) and **facility markers** (from `getWave4Intel`).
- Add a toggle strip (Admin lvl 4/6/7, Facilities by category, Slope, Drainage) and a color legend chip.
- Load Overpass boundaries via new `src/lib/wave4-overlays.functions.ts` (cached 30 min).

## 2. Wave 4 score drill-down
- New `Wave4ScoreDetail` component inside `wave4-panel.tsx` — each score row (Accessibility / Infra / Environment / Development / Composite) expands to show:
  - contributing facility counts (with the exact multipliers used in `score()`),
  - distance buckets (0–500 m / 0.5–1.5 km / 1.5–3 km),
  - rainfall + temperature normal ranges,
  - the raw dataset link (OSM Overpass, Open-Meteo).
- Refactor `score()` in `wave4-intel.functions.ts` to also return a `breakdown` object so the UI shows the same numbers the score used.

## 3. Wave 4 refresh + timestamps
- Add `?refresh=true` bypass to `getWave4Intel` cache.
- Panel header shows "Updated 3 min ago" and a **Refresh** button that re-invokes with cache bust; TanStack Query `refetch()` + `dataUpdatedAt`.

## 4. Map: Slope + Drainage layers
- In `leaflet-layers-map.tsx` add tile overlays:
  - **Slope**: OpenTopoMap hillshade (`https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png`) blended over base.
  - **Drainage**: OSM `waterway` Overpass overlay rendered as blue polylines (loaded on demand, cached).

## 5. Wave 1 — 3D slope/contour visual
- New `Terrain3D` component using `three` (already in stack for Cesium) or a lightweight canvas rendering:
  - Fetch a small elevation grid via Open-Meteo elevation or Open-Topo-Data (`https://api.opentopodata.org/v1/aster30m?locations=...`) — 11×11 grid around point.
  - Render an isometric heightmap mesh with contour lines.
- Slot into the existing Weather panel (Wave 1) tab.

## 6. Wave 2 / Wave 3 verification
- Read `cesium-globe.tsx` / `heatmap-map.tsx` / `mapillary-view.tsx`; verify load paths and add loading/error UI where missing. Add a smoke check that each renders their expected root (`canvas.cesium-widget`, `.leaflet-heatmap-layer`, `.mapillary-viewer`).

## 7. New PDF report
- Rewrite `pdf-dossier.ts` with a designed layout:
  - Cover: hero static map + address + composite investment score gauge.
  - Section 1 — Location & Admin (Wave 4 admin).
  - Section 2 — Environment (Wave 1 weather + climate normals + slope thumbnail).
  - Section 3 — Infrastructure (Wave 4 facility table + counts bar chart).
  - Section 4 — Investment scoring (radar/bar chart of 4 sub-scores + AI wording per metric with confidence).
  - Section 5 — Data sources & compliance.
- Chart rendering: draw simple bar/radar directly to jsPDF canvas (no headless browser needed on Worker).
- Prominent "Download PDF" button on `/explore` header — glass + accent gradient with icon.

## 8. E2E smoke test
- `tests/e2e/wave4-smoke.spec.ts`: iterate through 3 known Kenya coords (Nairobi CBD, Kisumu, Mombasa). For each: search → open Wave 4 → click Admin/Public/Invest/Sources tabs → assert score values are integers 0–100 and at least one chart renders.

## Technical notes
- All new fetches use existing UA header + in-memory TTL cache patterns.
- No secrets added; everything remains free/open (OSM Overpass, Open-Meteo, OpenTopoMap, Open-Topo-Data).
- Node-only libs avoided — Worker-safe fetches only.
- Existing routes, tabs, and design tokens untouched.

## Deliverables checklist
```text
[ ] wave4-overlays.functions.ts
[ ] leaflet-layers-map.tsx (+ toggles, legend, slope, drainage, wave4 overlays)
[ ] wave4-intel.functions.ts (breakdown + refresh bypass)
[ ] wave4-panel.tsx (drilldown + refresh + timestamp)
[ ] terrain-3d.tsx (Wave 1)
[ ] weather-panel.tsx (mount Terrain3D)
[ ] pdf-dossier.ts (redesigned + Wave 4 section + charts)
[ ] explore.tsx (prominent Download PDF button)
[ ] tests/e2e/wave4-smoke.spec.ts
[ ] Verify Wave 2/3 open (add loading/error UI as needed)
```

Approve and I'll ship it end to end.