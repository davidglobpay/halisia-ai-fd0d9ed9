# Evidence-aware location, narration, and information cards

## Build
- Strengthen title-deed map matching with a reusable evidence assessment that considers the extracted location text, geocode precision, partial matches, county agreement, and provider uncertainty radius. Keep title/LR references out of location queries and never present a geocode as parcel geometry.
- Show the match confidence, evidence used, conflicts, uncertainty, and recommended verification steps beside the title-deed map.
- Reuse the zero-cost browser narration control on the executive summary, location overview, measured/projected module details, and geotechnical output, including each output's sources, confidence, and limitations where available.
- Add calm, picture-style icon treatments and compact visual indicators to the shared metric cards and key intelligence tiles without adding decorative animation or changing protected map/Spatial surfaces.

## Validation
- Extend unit coverage for location-match confidence and conflicting/partial matches.
- Run typecheck, focused unit tests, lint for changed files, production build, and browser checks for title-deed and report views on mobile and desktop.

## Technical details
- Frontend and shared deterministic logic only; no database, provider, or package additions.
- Existing Google geocoding, county polygons, browser speech synthesis, Lucide icons, and design tokens remain authoritative.
