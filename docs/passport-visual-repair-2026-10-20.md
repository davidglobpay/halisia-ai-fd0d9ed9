# Passport visual repair — 20 October 2026

Base: `524236a21c23e60fc27ec6b7abab97098d99bc8b`. Candidate build: `2026-10-20.1`.

## Implemented

- Bundle the exact existing website lockup and H mark PNG bytes in the release instead of relying on runtime asset-sidecar URLs for PDF branding. The source PNGs were retrieved from the existing published app asset endpoints, with PNG signatures checked. No logo redesign.
- Do not abort the user's PDF export if artwork decoding fails: use a named HALISIA.AI text fallback. Evict failed image loads from the session cache so a retry can recover; successful loads remain cached.
- Replace map previews throughout the Passport climate chapter with time-series charts where returned data supports them. MET temperature, one-hour rain and wind forecasts use Kenyan time; NASA climate shows monthly rainfall and temperature. Accessible value tables retain missing readings as gaps. No invented seasonal series.
- Show modelled soil depth-band cutaways and a slope explanatory section with percent-to-degree conversion, returned aspect, and regional elevation range. Equal-height soil bands and vertical exaggeration are explicitly labelled. No bedrock/water-table depth is plotted without evidence.
- Add user-initiated Google Maps Street View links for provider-located amenity points and PDF amenity cards. Coverage is not promised and the link does not assert that the panorama is on the plot. No Street View API request or key is added.
- Add collapsible land-use considerations to populated Passport tiles and labelled interpretation notes to the PDF evidence directory. These are investigation prompts, not foundation designs, crop suitability verdicts, prices, mineral reserves, employment forecasts, migration trends, safety assessments or investment returns.
- Preserve every returned forecast hour in PDF charts instead of sampling every third hour. Repair stale route-smoke build-marker expectation by reading the source build constant.

## Validation

737 unit tests / 56 files pass. TypeScript, lint with zero warnings, formatting and production build pass. Added regressions cover retry after an image failure, successful download invocation with unavailable artwork, source asset URLs, chart null gaps and true zero, percent-to-degree conversion, missing subsurface depths, cautious land-use interpretation and exact Street View target coordinates.

A synthetic 18-page layout PDF using exact branding and intentionally synthetic map placeholders was rendered and inspected (cover, weather and soil pages). This is layout QA, not a real-site report, and not hosted or Android download verification. No provider or paid AI requests were made during tests. Full authenticated hosted journeys remain pending.

## Still requires evidence / release gates

- Real photos of the stated crops, services, minerals and economic activity need a matching location, source, capture date where available, and reuse permission. Generic/generated imagery must not become physical proof. No substitute site photographs were added.
- Geological strata, bedrock and water-table depths require actual borehole, hydrogeological or geological records for the location. The current provider schema does not supply them.
- Resolve the current Cloudflare failed check and verify the hosted preview, authenticated PDF download, mobile layout and voice behaviour before production publication. Keep existing source/authentication protections and preserve private repository status.
- This branch is a reviewable release candidate, not evidence that production has changed. No database backfill, payment/Scout activation, news-job changes or paid Actions reruns were performed.
