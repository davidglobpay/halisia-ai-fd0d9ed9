
# HALISIA AI v2 — Implementation Plan

Scope is large. I'll deliver in the order below so each step is independently verifiable in the preview.

---

## 1. Google Maps counter-check + light mode + working layers

**What breaks today:** the map is loaded with only `styles`, no `mapId`. Layer toggles in `explore.tsx` are dead buttons. There's no light theme.

**Changes:**
- `src/components/halisia/map-view.tsx`: accept `mapType` (`roadmap` | `satellite` | `hybrid` | `terrain`) and `theme` (`light` | `dark`). Swap `styles` at runtime; call `setMapTypeId`.
- Add real overlays wired to Google's built-in layer classes:
  - Traffic → `google.maps.TrafficLayer`
  - Transit → `google.maps.TransitLayer`
  - Bicycling → `google.maps.BicyclingLayer`
- Custom KML/WMS overlays for slope, flood, drainage (see §3).
- `explore.tsx`: wire the top-left segmented control to `mapType` state; wire a new "Layers" popover with real toggles.

**Verification:** Playwright script clicks Map/Satellite/Layers, screenshots each, and asserts no console errors.

---

## 2. Remove 3D globe → futuristic 3D Kenya map

**Approach (from your answer):** Photorealistic 3D Tiles via Google's `Map Tiles API` rendered with `three.js` + `@loaders.gl/3d-tiles` (or `deck.gl`'s `Tile3DLayer`), centered on Kenya, with click-to-inspect anywhere.

Because the 3D Tiles API needs to be enabled on the connector's Cloud project, I'll:
1. Ship a `<Kenya3DMap />` component using `deck.gl` `Tile3DLayer` + `TerrainLayer` as fallback.
2. Add smooth camera fly-to (pitch 60°, heading auto-rotate) and click handler that reverse-geocodes the point via the existing gateway and pushes to `/explore?lat=..&lng=..`.
3. Replace `<Globe />` in `src/routes/index.tsx` with `<Kenya3DMap />`. Delete `src/components/halisia/globe.tsx`.
4. If 3D Tiles returns 403 (API not enabled), the component auto-falls back to tilted vector map + terrain and surfaces a one-line "enable Map Tiles API" hint in dev console only.

**Verification:** load `/`, screenshot, confirm 3D Kenya renders, click a point and confirm navigation to `/explore` with a marker at the clicked coords.

---

## 3. Real free-source overlays (slope / flood / drainage)

Kenya-relevant public sources rendered as tile overlays via `google.maps.ImageMapType`:

- **Slope:** OpenTopography SRTM 30m slope tiles (WMS → XYZ via public tile proxy). If WMS not available client-side, generate slope PNG tiles on the fly from Mapbox terrain-rgb equivalent using `nasadem` free tiles.
- **Flood:** JRC Global Surface Water occurrence WMS (`https://global-surface-water.appspot.com/tiles/occurrence/{z}/{x}/{y}`).
- **Drainage:** HydroSHEDS river network — served through OpenStreetMap `waterway` tiles as a proxy (`https://tiles.openfreemap.org` waterway style) OR direct HydroSHEDS WMS.

**Server function `src/lib/layers.functions.ts`:** small proxy that returns proper CORS-safe tile URLs and caches attribution text. Attribution rendered in map corner (required by all three providers).

**UI:** Layers popover with three toggles + opacity slider each.

---

## 4. Rich, AI-enhanced location intelligence with evidence

For each searched location, `explore.tsx` fetches a new `getLocationDossier` server function that returns:

```
{
  location: { address, lat, lng, adminArea },
  photos:   [{ url, attribution }] (Places API New photos),
  streetView: url (Street View Static),
  staticMaps: { light, satellite, floodOverlay, slopeOverlay },
  layers:   { slopeAvg, floodRiskPct, drainageDensity, elevation },
  webContext: [{ title, snippet, url }] (Google web search via connector, capped 5),
  ai: { summary, risks[], opportunities[], perCategoryNarrative{} } (Gemini via existing gateway),
  confidence: 0-100
}
```

New files:
- `src/lib/dossier.functions.ts` — orchestrates Places/StreetView/Elevation/staticmap gateway calls, then feeds the assembled evidence into Gemini for narrative.
- `src/components/halisia/dossier-view.tsx` — replaces `intelligence-cards.tsx` on `/explore` with an infographic layout: hero photo, static map thumbnails per layer, per-category cards each showing `map evidence | photo evidence | web sources | AI narrative`, radial score charts.

Old `intelligence-cards.tsx` kept as a fallback loading skeleton, deleted once new view is stable.

---

## 5. Printable per-location PDF (5–8 pages)

- New server route `src/routes/api/public/report.$slug.ts` — accepts `{ lat, lng, address }`, calls `getLocationDossier`, then generates a PDF server-side using `@react-pdf/renderer` (Worker-compatible, pure JS). Returns `application/pdf`.
- PDF structure:
  1. Cover: hero photo, address, coords, overall confidence, generated date.
  2. Executive summary (AI).
  3. Location map — light theme static map.
  4. Infrastructure & access (roads/transit) with map evidence.
  5. Environmental risk (flood + slope overlays as embedded images).
  6. Drainage & water systems.
  7. Web intelligence (sources cited).
  8. Methodology & confidence footer.
- Uses ChartJS-node-canvas replacement: `chart.js/auto` rendered to SVG via `chartjs-node-svg` (Worker-safe).
- UI: "Download PDF report" button in `dossier-view.tsx` header.

**Verification:** Playwright downloads the PDF for a fixed address, converts to images via `pdftoppm`, and I visually inspect every page.

---

## 6. Harden `build:dev` + full production build

- `package.json`:
  - `"typecheck": "tsgo --noEmit"`
  - `"lint": "eslint ."`
  - `"build:dev": "bun run typecheck && bun run lint && vite build --mode development"`
- Run `bun run build` (production) and verify `dist/` is produced, then serve it and load `/explore` in Playwright, screenshot, assert zero console errors.

---

## 7. Sentry client + server error reporting with source maps

- `bun add @sentry/react @sentry/tanstackstart-react`
- `src/lib/sentry.client.ts` — `init` with `VITE_SENTRY_DSN`, `tracesSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`.
- `src/lib/sentry.server.ts` — server-side `init` with `SENTRY_DSN`; imported from `src/server.ts`.
- `src/lib/lovable-error-reporting.ts`: also forward to `Sentry.captureException`.
- `src/routes/__root.tsx`: init Sentry client-side once in `RootComponent`.
- `vite.config.ts`: add `@sentry/vite-plugin` for source-map upload gated on `SENTRY_AUTH_TOKEN` env var (silently disabled when missing so local builds don't fail).
- Secrets needed from user via `add_secret`: `SENTRY_DSN` (also mirrored to `VITE_SENTRY_DSN`) and `SENTRY_AUTH_TOKEN` (build-secret; I'll instruct them to add it in Workspace Settings → Build Secrets).

---

## Technical details

- 3D Tiles endpoint: `https://tile.googleapis.com/v1/3dtiles/root.json` proxied via existing `google_maps` gateway prefix `3dtiles/` — if the connector rejects that prefix I'll route through a thin server function using the same key.
- All new server functions live in `src/lib/*.functions.ts` (client-safe path).
- All fetches surface provider status + body on `!response.ok`.
- All new npm deps are Worker-compatible (pure JS): `@react-pdf/renderer`, `deck.gl`, `@loaders.gl/3d-tiles`, `@sentry/react`, `@sentry/tanstackstart-react`, `@sentry/vite-plugin`.
- Input validation with Zod on every new server fn / route.
- No changes to auth model; all new endpoints are read-only public reports gated only by rate of the Maps connector.

---

## What I need from you before I start step 7

- Confirm you'll add `SENTRY_DSN` (runtime) and `SENTRY_AUTH_TOKEN` (workspace build secret). I'll open the `add_secret` prompt at the right moment; you don't need to paste anything now.

I'll start on §1 as soon as you approve.
