# Konza LR Test Fixture — Preview-Only Plan (no code changed in this turn)

Goal: a non-production, dev-gated test fixture that exercises title/LR no-match handling, an independently supplied physical coordinate, location-only satellite imagery, uploaded model selection, 3D viewing, and the existing AR/VR handoffs — without touching Spatial internals, parcels data, or the schema.

## A. Files to READ (no change)

- `src/routes/spatial.tsx` — read only, to copy the *call shape* of the existing model handoff (absolute-URL helper, Scene Viewer intent string, `rel="ar"` Quick Look anchor, fallback messaging).
- `src/components/halisia/spatial/spatial-canvas.tsx` + `.internal.tsx` — read only, to confirm the public props/handle contract.
- `src/components/halisia/spatial/spatial-search.tsx`, `src/lib/spatial-data.ts`, `src/lib/spatial.ts` — read only, to reuse `SpatialParcel` shape, `verificationDisplay`, and identifier-matching semantics.
- `src/lib/spatial-platform.ts` — read only, truthful fallback copy.
- `src/lib/geocode.functions.ts` — read only; it is the D-29 risk surface.
- `src/hooks/use-dev-mode.ts`, `src/routes/style-guide.tsx` — read only, to pick the dev-gated host.

## Files proposed to CHANGE later (minimal, all non-protected)

1. `src/lib/testfixtures/konza-lr-fixture.ts` (new) — frozen, in-memory fixture constant. Not a parcel.
2. `src/lib/testfixtures/fixture-log.ts` (new) — PASS/FAIL/UNKNOWN test log model + in-memory recorder.
3. `src/components/halisia/testkit/lr-fixture-panel.tsx` (new) — the dev-gated fixture UI (identifier resolution result, coordinate card, satellite tile, model picker, handoff buttons, log table).
4. `src/routes/style-guide.tsx` (edit, ~5 lines) — mount `<LrFixturePanel />` behind `useDevMode()` only. This is the only edit to an existing file.
5. `tests/unit/konza-lr-fixture.test.ts` (new) — assertions in section G.
6. Optionally `tests/e2e/lr-fixture.spec.ts` (new) — dev-mode smoke; does not touch `/spatial` specs or snapshots.

Uploaded GLBs would be placed under `public/_fixtures/` (new folder, distinct from the protected `public/_massing/`). No existing asset is touched, renamed or re-exported.

## B. Protected-path check

`/spatial` and everything under `src/components/halisia/spatial/` is protected → **no file there is edited**. The fixture is hosted on `/style-guide`, an existing QA surface, behind `?dev=1`. No new route is added. If you prefer a dedicated `/lr-fixture` route, that needs an explicit exception since the brief forbids new routes.

Spatial bundle stays byte-identical because no module in the Spatial graph is imported *from* the fixture and no Spatial file is edited. The fixture renders 3D through its own `<model-viewer>`-free path: a thin local canvas wrapper that imports `three` directly (already a dependency), not `spatial-canvas.internal`.

## C. Zero-schema-change approach

No migration, no `INSERT`, no geometry write, no RLS change, no storage bucket change. The fixture never calls `fetchSpatialParcels()` for a write and never persists anything. All state is component state; the log is in-memory and copy-to-clipboard only.

## D. Ephemeral fixture representation

A frozen object with a deliberately non-parcel type so it can never be passed where a `SpatialParcel` is expected:

```text
TestFixture {
  kind: "EPHEMERAL_TEST_FIXTURE"            // never "parcel"
  searchedTitle: "KONZA SOUTH/KONZA SOUTH BLOCK 5 (KONZA)/14726"
  documentStatedAreaHa: 0.0440              // document-stated, unverified
  documentStatedRegistryMapSheet: "14"
  physicalTestCoordinate: { lat: -1.7568583, lng: 37.1036167,
                            source: "USER_SUPPLIED_PHYSICAL_TEST_POINT" }
  matchedParcelRecord: null                  // structurally separate slot
  resultState: "NOT_IN_INDEX" | "EXTERNAL_VERIFICATION_REQUIRED"
  boundaryEvidence: "NONE"
  geometry: null                             // no polygon is ever synthesised
}
```

Three separate labelled UI blocks: **Searched title**, **Physical test location (user-supplied)**, **Matched parcel record — none**. No merging, no derived polygon, no area badge implying a boundary.

## E. Model picker / handoff reuse

- Cohort list is data, not code: `SKY_Apartment_2_sky_day_ar.glb` and `SKY_Apartment_2_sky_night_ar.glb` are tagged `role: "environment-control"` and are **not selectable as building candidates**; `Apartment_3`, `Apartment_1_2`, `Market_Day`, `Apartment_6_Rooftop_Bar` are `role: "building-candidate"`.
- Handoffs are reproduced by *calling the same URL construction rules* read from `src/routes/spatial.tsx` (absolute HTTPS URL, Scene Viewer intent, `rel="ar"` anchor). Renderer, XR session, hit-test and re-place internals are neither imported nor modified.
- WebXR/VR handoff in the fixture is a link back to the existing `/spatial` studio, not a re-implementation.
- Missing USDZ → Quick Look button is disabled with "USDZ not published for this model", logged `UNKNOWN`, never `FAIL`.
- Every model is labelled **indicative massing — not construction documentation** and **fit against a legal parcel boundary: UNAVAILABLE (no evidence-backed polygon)**. No auto-scale-to-area; models render at authored scale and the panel states scale is authored, not fitted to the 0.0440 ha document figure.

## F. Satellite imagery without cadastral assertion

Static satellite tile centred exactly on `-1.7568583, 37.1036167` at close zoom, using the existing imagery helper path (`src/lib/static-map-*`) with no overlay, no polygon, no boundary line. Caption, always visible: "Location imagery centred on the user-supplied test coordinate. Not cadastral evidence and not a title boundary."

## G. Test assertions

1. Resolving the LR string returns `resultState ∈ {NOT_IN_INDEX, EXTERNAL_VERIFICATION_REQUIRED}` and `matchedParcelRecord === null`.
2. Resolution of a title/LR identifier never calls `geocodeAddress` and never runs nearest-parcel selection.
3. `boundaryEvidence === "NONE"` and `geometry === null` for every fixture state.
4. Rendered text contains no "verified title", "verified parcel", "survey verified", or ownership/title-validity phrasing.
5. Coordinate is rendered only under the "physical test location (user-supplied)" label.
6. No 440 m² (or any) polygon is produced from the coordinate.
7. Selecting an environment/sky GLB does not enable building-fit or Scene Viewer building claims.
8. Scene Viewer href is absolute HTTPS and matches the existing intent format; Quick Look anchor only renders when a real USDZ exists.
9. Model-fit indicator is `UNKNOWN` in every state.
10. Return-to-passport: leaving and re-entering the fixture preserves searched title, coordinate and selected model.
11. `SELECT count(*) FROM parcels` equals 3 before and after the run.

## H. D-29 identifier→locality substitution guard

Two-layer: (1) the resolver branches on shape first — anything matching an LR/title/parcel-code pattern goes to the exact-match-only path and the geocode branch is unreachable for it; (2) a runtime assertion in the fixture records `FAIL` if a resolution result carries both an identifier query and a geocoded lat/lng, plus a unit test that spies on `geocodeAddress` and asserts zero calls for the Konza LR string.

## I. Keeping parcels at exactly 3

Fixture has no write path at all (read-only Supabase usage, and only for display of the untouched three records if needed). Pre- and post-batch `select count(*)` check is part of the acceptance run. No migration is authored.

## J. Requires physical hardware — cannot be validated in-browser

- Android Chrome + ARCore Scene Viewer launch and tracking — PHYSICAL DEVICE TEST REQUIRED
- iPhone/iPad Safari Quick Look (also blocked until USDZ exists) — PHYSICAL DEVICE TEST REQUIRED
- Meta Quest / Apple Vision Pro immersive VR — PHYSICAL DEVICE TEST REQUIRED
- Real-world positional accuracy at the Konza coordinate — PHYSICAL DEVICE TEST REQUIRED

Headless validation covers: no-match logic, structural separation, satellite centring/caption, model picker roles, handoff URL construction, 3D viewing, log states, typecheck/lint/unit/build.

## Verdict

**SAFE ONLY WITH CHANGES** — safe as specified provided two points are confirmed:
1. Hosting the fixture on `/style-guide` behind `?dev=1` is acceptable (the brief forbids new routes; a dedicated `/lr-fixture` route would need an explicit exception).
2. The six uploaded GLBs are delivered into a new `public/_fixtures/` folder, leaving `public/_massing/` untouched.

Nothing is edited, migrated, or deployed in this planning turn.
