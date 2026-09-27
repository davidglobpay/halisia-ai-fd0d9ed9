# Super Land Passport: every land fact in one place, with its evidence

## What the audit found

The Land Passport page already has 14 sections, but it only uses part of the data HALISIA already collects. Several strong sources that run elsewhere in the app never reach the passport:

| Data HALISIA already has | Where it lives today | On the Passport? |
|---|---|---|
| Google elevation, air quality, nearby places (schools, hospitals, water, transport) | Location intelligence | Yes, partly |
| Soil (clay/sand/silt, organic carbon, density) from ISRIC SoilGrids | Geotechnical report | No |
| Slope and terrain grid (OpenTopoData ASTER 30 m, Open-Meteo) | Geotech / terrain views | No |
| 30-year rainfall and temperature climate normals (Open-Meteo climate) | Geotech + Wave 4 | No |
| Bearing capacity, shrink-swell, groundwater and foundation suitability | Geotech calculations | No |
| OSM roads, amenities and land use (Overpass) and admin area (Nominatim) | Wave 4 intelligence and overlays | No |
| Coverage-gated investment composite ("Not assessed" when coverage is thin) | Wave 4 (P0-C fix) | No; the passport uses a simpler engine |
| County facts, county boundary, Pulse news | County pages, Pulse | Yes |
| Title-deed OCR fields (if the passport came from a deed) | Title deed | Only the reference text |
| Listing data: price, size, seller, documents | Marketplace | No |
| AI narrative, insurance brief, lender summary | Reports / financing / insurance | No |

**Main gap:** users can't see where each number came from, how fresh it is, how it was used, or how sure HALISIA is about it.

## What the Super Land Passport becomes

It stays one page, reached through the same buttons everywhere. It is regrouped into 8 chapters, and every data point uses the same **Evidence Row**:

```text
Value | Source (provider, dataset) | Retrieved / dataset date | Method
Used for: which scores / sections depend on it
Evidence class: Measured · Modelled · Official · Seller-provided · AI interpretation · Not available
Confidence: High / Medium / Low / Not assessed  [View raw]
```

### Chapters
1. **Identity and position:** reference, title/LR as supplied, position class, uncertainty radius, source conflicts. Limited mode when there are no coordinates.
2. **Administrative context:** county, sub-county/ward (from reverse geocoding), county facts, a County Intelligence link.
3. **Physical land:** elevation, slope and aspect, terrain profile, soil profile by depth, drainage hint. The page states that elevation alone does not show flood risk.
4. **Climate and environment:** 30-year rainfall and temperature normals, current air quality, riparian/water proximity from OSM.
5. **Access and services:** road type and distance, drive times, schools, health, water, markets, power proxies. Each item shows its count and the search radius used.
6. **Build and develop:** foundation suitability, bearing capacity range, shrink-swell, groundwater, indicative development concepts, construction cost drivers. These are labelled indicative, not approvals.
7. **Market and investment:** listing facts if present, the coverage-gated investment composite with its formula, weights and factors, risks, drivers and unknowns. No return predictions.
8. **Legal, finance and trust:** what HALISIA has and hasn't checked (clearly separating Source listed, Data completeness, Documents reviewed, Evidence verified and Regulator verified), finance readiness (not loan approval), local Pulse news, and a combined "What we do not know" list.

### Top of page
- **Passport summary strip:** location class, county, number of data points measured vs missing, overall coverage bar, last refreshed time.
- **Evidence ledger drawer:** one table listing every source queried, its status (ok / failed / no data / rate-limited / cached), timestamp, and which chapters used it. A provider failure never looks like "zero results".
- **AI interpretation box:** an optional short AI summary built only from the evidence rows, with citations back to the rows. It is shown apart from source data and turned off when coverage is low.
- **Download:** reuse the existing PDF dossier, adding the evidence ledger as its final page.

## Truth rules kept
- No ownership, title, boundary or registry verification claims; eCitizen and Ardhisasa are not integrated and the page says so.
- Low coverage shows "Not assessed" with no numbers or progress bars.
- Map mode, Street View and satellite unavailable states stay explicit.

## Technical details
- New `src/lib/passport-evidence.ts`: an `EvidenceItem` type plus a builder that maps existing results (location-intel, geotech, wave4, county facts, listing) into chapters. It's pure and unit-tested.
- The passport route calls existing server functions in parallel with React Query (`getLocationIntel`, `getGeotechIntel`, `getWave4Intel`, `reverseGeocode`, `fetchFeed`). No new external APIs, packages or database changes.
- New components under `src/components/halisia/land-passport/`: `evidence-row.tsx`, `evidence-ledger.tsx`, `chapter.tsx`, `summary-strip.tsx`.
- AI summary: one new server function on the Lovable AI Gateway (`openai/gpt-6-astra`, streamed, evidence-only prompt, run only when the user asks).
- Tests: unit tests for the evidence builder (coverage gating, failure vs empty, no verification wording) plus a Playwright check of both the full and the limited passport at 360 px and desktop.
- Spatial, Model Lab, massing assets, Konza fixtures and migrations are not touched.
