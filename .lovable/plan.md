# Evidence predictions and globe-to-Nairobi hero

## What will change
- Reuse the Land Passport’s existing Wave 4 public-data response to produce evidence-backed contextual signals instead of leaving all relevant cards unassessed.
- Keep legal status, ownership, title, utilities, safety, community submissions, approved plans, prices and returns explicitly unassessed where no supporting dataset exists.
- Label derived outputs as contextual indicators—not valuations, forecasts, confirmations or official records—and show sources, confidence, limitations and next steps.
- Upgrade the landing Hero Map intro into a lightweight staged journey: galaxy/world, rotating continents, Africa, Kenya, county divisions and Nairobi, then hand off to the existing interactive map.
- Preserve reduced-motion behavior, session-once playback, mobile performance and all protected Spatial/WebXR/Model Lab surfaces.

## Technical details
- Extend the pure intelligence engine with an optional Wave 4 input and only expose supported OpenStreetMap/Open-Meteo-derived indicators when confidence is medium or high.
- Pass the already-fetched Passport Wave 4 result into the engine; avoid adding duplicate network requests or changing unrelated consumers.
- Keep unsupported modules and existing conservative fallbacks unchanged.
- Enhance the existing inline SVG/CSS globe animation without new dependencies or WebGL, using bundled county geometry only where practical and truthful stage labels throughout.
- Add focused unit tests for supported/withheld prediction states and globe sequence safeguards.

## Validation
- Run typecheck, focused/unit tests, lint on changed files, and production build.
- Browser-check the Passport evidence cards and landing animation on mobile and desktop, including reduced motion and graceful map/provider fallback.
