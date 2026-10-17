# Inline map context on data output tiles

Located Land Passport findings now display their map image inside the original data row. The former standalone “Show on map” presentation is removed from the Passport route. Satellite is the default; Map and Terrain use the same reference tile services already configured in the fallback map. Selecting the image retains the existing main-map focus behavior and keyboard support.

The shared map-evidence card component also supports inline previews for future reuse. County profiles already have their own always-visible image strip and are unchanged.

## Evidence rules

- Provider-reported nearby places use their runtime coordinates. The image locates the nearest mapped example, not every result in an aggregate.
- User-supplied pins remain explicitly user supplied.
- Regional estimates use a broader zoom and “Regional sampling context” label. Their imagery does not prove soil, climate, flood, groundwater or foundation conditions.
- No coordinate is invented for county statistics, missing data or unlocated findings.
- Image and finding source/capture metadata remain distinct. The new tiles have no independently established capture date. Retrieval does not become capture or accuracy.
- A point pin is not surveyed geometry, ownership, legal access or a parcel boundary.
- Provider errors show an unavailable message, never a generated or representative substitute.
- Native tile coordinates center the view without altering the recorded point. Unsupported Mercator latitudes are withheld instead of moved.

## Cost and loading

No new SDK, paid API, API key, AI call, database write or spatial/XR mutation is introduced. The browser loads native reference tiles lazily as their data rows become visible. Provider usage terms, availability and network/data costs still apply. No offline bulk download or imagery archive is created.

## Validation limits

Unit and synthetic browser fixtures test coordinate projection, scope labels, image failure, layer changes, keyboard focus and mobile layout. Synthetic tile images are marked as test fixtures and are never application evidence. One real satellite tile returned HTTP 200/image/jpeg and was visually inspected; this is a provider availability check, not a title, feature or ground-condition verification.

Release marker: 2026-10-17.1. Production publication remains subject to the existing material security gates. Do not describe a source commit or ready state as proof of deployment.
