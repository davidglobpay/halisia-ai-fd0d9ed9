# Visual Land Passport

Build 2026-10-17.3 replaces the text-only Passport export with an asynchronous,
source-labelled visual report. It awaits the exact home-page lockup and H mark,
uses the website palette, and draws header/footer branding plus the H watermark.

The report can embed existing satellite, road and terrain reference tiles;
county emblem/reference facts; monthly NASA POWER climatology charts;
MET Norway short-term forecast charts and condition symbols;
ASTER regional-gradient schematics; SoilGrids composition bands by depth;
and located amenity cards with maps, source coordinates and labelled distances.
Only returned datasets are drawn. Image failure is not replaced with generated imagery.

The restored on-screen findings include populated source-backed regional estimates
and reference statistics. Unconnected registry findings and unsupported numerical
bedrock/water-table depths, foundation prescriptions and return forecasts are
not promoted to facts. A schematic slope is not a surveyed cross-section.
County economic activities are county context, not parcel findings. Named current
political assessments and mineral reserves need additional authoritative evidence.

## Provider repairs

- Keep climate/admin successes independently when Overpass fails; a failed mapping
  lookup cannot create a zero-facility finding.
- Match the Overpass transport deadline to its server query timeout.
- Replace climate requests with NASA POWER climatology, retaining its returned
  reference period and declared units. Convert mean mm/day with stated day counts;
  exclude missing/sentinel values. Cache and deduplicate concurrent requests.
- Use MET Norway Locationforecast with an identifying User-Agent and CC BY attribution.
- Reject missing elevation-grid samples rather than treating them as zero metres.
- Do not substitute a different elevation dataset under an ASTER source label.
- Wait for source responses before enabling export; show pending/error state.
- Repair the npm lockfile's build-tool version mismatch. Formatting-only adjustments
  do not change spatial, geometry, auth or database behaviour.

## Verification and limits

Synthetic fixtures test PDF image embedding, pagination, missing-value semantics,
partial provider failures, signed-in UI, map focus and responsive layout. They do
not verify real authentication, registry access, cadastral boundaries, geological
conditions, provider uptime or imagery capture dates. Real NASA/MET API responses
were inspected separately; all fixture imagery is labelled synthetic.

The report does not yet embed original facility photographs with their complete
provider photographer attributions, parcel survey profiles, borehole logs or a
complete traversable road network. Its road map is reference context, not a legal
access determination. Paid activation requires applicable provider/licensing review.
