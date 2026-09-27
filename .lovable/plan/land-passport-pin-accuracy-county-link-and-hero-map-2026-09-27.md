# Land Passport, pin accuracy, county link and hero map

## What the audit found
- **Title-deed pin:** the pin comes from turning text read off the deed (location name) into a place with Google, then dropping a pin as if it were exact. That is the main cause of wrong pins. There is no county/Kenya range check and no "approximate" label.
- **Ardhisasa / eCitizen:** not connected. The app already says so honestly. The passport will show "Official search not connected — run it on Ardhisasa" rather than pretend.
- **Land Passport:** one exists, but only inside the 3D Spatial page and only for stored survey parcels. That page is protected, so it stays untouched.
- **Intelligence engine, county facts, Pulse news, confidence badges, geotech, amenities:** all exist and will be reused, not rebuilt.
- **Landing page:** there is no hero map today — only the county map lower down. A search box sends people to Explore.
- **Marketplace:** listing pages have coordinates and an intelligence panel, but no passport or county link.

## What I will build (smallest set)
1. **One location checker** — checks number ranges, Kenya bounds, swapped lat/lng, zero/blank values, the "default Nairobi centre" trap, and compares two sources (e.g. deed location vs geocode). Gives each pin a status: Verified geometry / Verified coordinate / Approximate (geocoded) / Administrative area / User-placed / AI-inferred, with a reason, source and confidence. Shows "Location discrepancy detected" with both sources and the distance when they disagree by more than ~2 km.
2. **Title-deed page** — pin now carries that status; approximate pins shown as a soft circle, not a sharp point; no Nairobi fallback.
3. **One Land Passport page** (`/passport?lat=&lng=&ref=&source=`) — one link that works from title-deed, Explore, map clicks, marketplace, saved items and shared links. Sections: Identity, Location verification, County intelligence, Physical land, Accessibility, Habitability, Investment (opportunities / risks / drivers / unknowns), Development concepts, Construction notes, Finance readiness ("Indicative AI analysis — not a bank loan approval"), Legal/ownership (clearly "not connected"), Local news, Confidence broken into six parts, and "What Halisia does not yet know". Every section is labelled Source data vs AI interpretation. Built from the existing engine and panels.
4. **County Intelligence button** — works out ward → sub-county → county from the coordinate (existing reverse lookup), then opens the existing county page with the place pre-selected, plus a short county card inside the passport.
5. **"View Land Passport" buttons** on title-deed results, Explore results, marketplace cards and listing pages, and saved items.
6. **Hero map on the landing page** — reuse the existing Google map with Map / Satellite / Street View buttons, search, pan/zoom, a pin that opens the passport. Street View shows "Street View unavailable at this location" when Google has none; if Google fails, the existing street-map fallback appears with a clear note.
7. **Tests** for the location checker and one browser run on phone width covering search → pin → passport → county, marketplace → passport, and the hero map toggles.

## Decision needed: colours
Your brief asks for a Kenyan-flag red/green/black palette with neon glow. The approved Halisia look (saved earlier) is the ivory / deep-forest / green / sparing-gold style, with red kept only for real risk warnings, and explicitly "no dark Kenyan-flag theme". **I will keep the approved look** so nothing already built changes. Tell me if you want the flag palette instead — that would be a separate re-skin.

## Honest limits
- Exact parcel boundaries can only appear where a surveyed parcel already exists in the database; for any deed without one, the pin stays "Approximate".
- Street View works only on the published halisia site address and where Google has imagery.
- Scores are never invented; missing data shows as a data gap.

## Technical notes
- New: `src/lib/location-validation.ts`, `src/components/halisia/land-passport/*` (named to avoid the Spatial one), `src/routes/passport.tsx`, `src/components/halisia/hero-map.tsx`, unit tests.
- Edits: `title-deed.tsx`, `explore.tsx`, `marketplace.$id.tsx`, `marketplace.index.tsx`, saved page, `index.tsx`, `map-view.tsx` (add optional Street View pano via Maps JS `StreetViewService`, browser key only).
- No database changes, no new packages. Protected Spatial/Model Lab/Konza/massing untouched.
