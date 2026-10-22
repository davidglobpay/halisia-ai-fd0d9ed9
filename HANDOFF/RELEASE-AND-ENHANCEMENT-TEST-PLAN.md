# HALISIA release gate and next-feature test pack

Date: 2026-10-22  
Repository: `davidglobpay/halisia-ai-fd0d9ed9`  
Working branch: `codex/halisia-2026-10-22-complete`  
Current PR: [#31](https://github.com/davidglobpay/halisia-ai-fd0d9ed9/pull/31)

## Release status — NOT CLEARED

The latest candidate commit is not verified by executable CI. The GitHub Actions quality job is reported as failed but has no recorded steps; Playwright is skipped because it depends on the quality job. Do not interpret this as a code-test pass or a code-test failure.

The landing-page location search was restored on 2026-10-22 in commit `e39a12e344e7c9189cc6419f6e52156b2aacc2c5`. This change still requires the test gate below.

PR #31 is stacked on `codex/passport-image-recovery-20261022`, not `main`. Do not merge or retarget it blindly. First establish the intended release base and include all prerequisite work in the release diff.

## Required release gate

Run from a clean checkout of the intended release candidate, with the repository's lockfile unchanged:

1. `bun install --frozen-lockfile`
2. `bun run format:check`
3. `bunx eslint . --max-warnings=0`
4. `bun run typecheck`
5. `bunx vitest run`
6. `bunx vite build --mode development`
7. `bunx vite build --mode production`
8. `bunx playwright install --with-deps chromium`
9. `bunx playwright test`
10. Verify generated Land Passport PDFs open, have no clipped/overlapping sections, retain source links, and download from every UI entry point.
11. Run post-deploy smoke tests on the actual published URL, not only preview.

Record command, exit code, commit SHA, and any failure output in the release report. Do not suppress warnings, weaken tests, skip failed checks, or mark an unexecuted check as passed.

## P0 counter-checks

### Landing search and map entry
- [ ] Search control is visible on desktop and mobile.
- [ ] Entering a county/town/address navigates to `/explore?q=...`.
- [ ] Entering latitude/longitude navigates to Explore and resolves the intended point.
- [ ] Empty search does not navigate.
- [ ] Keyboard submit and screen-reader label work.
- [ ] “Pick a point on the map” scrolls to the element with id `hero-map`.
- [ ] `/explore` remains directly accessible from a URL.

### Land Passport and PDF
- [ ] PDF export works with news available, news empty, and news lookup failure.
- [ ] External news links are valid HTTP(S) links; county-level news is labelled as not parcel-specific and not HALISIA-verified.
- [ ] Satellite/map tile partial failure preserves valid tiles without generating a misleading blank image.
- [ ] Image attribution is visible whenever third-party imagery is used.
- [ ] Climate values distinguish modelled grid-cell means from parcel measurements and forecasts.
- [ ] Terrain values are labelled as regional/modelled, and the slope sketch is explicitly schematic.
- [ ] Soil copy does not infer bedrock depth, water table, foundation suitability, or bearing capacity.
- [ ] Amenity distances are explicitly straight-line, and returned records are not described as proof that a facility is operating.
- [ ] Zero-only chart data is explained instead of rendering a misleading flat chart.
- [ ] Long evidence sections paginate without clipped titles, orphaned headings, or text outside page bounds.
- [ ] Every PDF dossier/download button is clickable and yields a readable PDF.

### GIS and satellite provider
- [ ] Each layer's provider, resolution/scale where available, acquisition/update date where available, attribution, and limitations are shown.
- [ ] Satellite imagery and map tiles are never presented as survey, title, boundary, ownership, or legal-access evidence.
- [ ] Coordinate order is tested at Kenya locations (latitude then longitude internally; provider URL/API conventions checked at each adapter).
- [ ] No paid API endpoint is activated without an explicit owner decision and documented key/billing requirement.
- [ ] Offline/provider failure returns an honest unavailable state, not fabricated imagery or copied coordinates from another location.
- [ ] Provider terms, attribution, rate limits, and caching restrictions are reviewed before launch.
- [ ] GIS code and satellite API are tested independently, then end-to-end through the UI and PDF export.

## New enhancement pack — test-ready scope

Do not enable these as production claims until the checks below pass. Implement one small vertical slice at a time.

### Feature A — Evidence provenance panel
Purpose: make each GIS-derived value auditable.
- Show value, source/provider, observation/model date if supplied, resolution/measurement type, and a plain-language limitation.
- Missing metadata is displayed as “not supplied”; never infer it.
- A provider error must not erase unrelated evidence.
- Acceptance: unit tests cover present/missing metadata, provider errors, and mismatched coordinate responses; browser test verifies the panel on desktop/mobile; PDF test verifies provenance is retained.

### Feature B — Satellite/GIS layer health
Purpose: show which layers actually loaded for the selected location.
- Track each requested layer as loaded, partial, unavailable, or not requested.
- Preserve successful layers when another provider fails.
- Never show “live” unless the provider actually supplies live/current data.
- Acceptance: tests simulate all-success, partial-tile failure, total outage, timeout, and empty data; no test uses a real paid endpoint or secret.

### Feature C — Parcel report coverage checklist
Purpose: tell users what the report did and did not verify.
- Separate sourced/reference, modelled, community-submitted, and missing evidence.
- Explicitly state that imagery is not title/boundary verification and modelled terrain/soil is not a site survey.
- Never calculate a suitability score or construction verdict from unmeasured inputs.
- Acceptance: fixture tests for complete, partial, empty, and contradictory evidence; generated PDF must show missing evidence without inventing values.

### Feature D — Saved test cases for repeatable QA
- Maintain anonymised Kenya test locations covering urban, peri-urban, rural, coast, and highland contexts.
- Store expected provider-independent invariants (valid coordinate bounds, source attribution present, no unsupported claims), not brittle exact imagery pixels.
- Acceptance: CI runs fixtures without secrets or paid calls; live-provider tests are opt-in and separately labelled.

## Deployment checklist

- [ ] Resolve GitHub Actions runner/job initialization failure and obtain a run with actual steps.
- [ ] All required CI checks pass on the exact release commit.
- [ ] Confirm PR base and release branch; review full cumulative diff against `main`.
- [ ] Confirm no secrets or credentials were committed.
- [ ] Publish through the connected hosting provider only after release gate passes.
- [ ] Confirm the provider reports deployment success and capture the deployed commit/build marker.
- [ ] Smoke-test home, search, Explore, map layers, Passport generation, PDF download, sign-in, and mobile layout.
- [ ] Rollback path is known before release.

## Owner-only blockers

- GitHub Actions needs to execute jobs normally; current run records show no steps, so a developer cannot infer source-code correctness from the failed status.
- Publishing to the Lovable-hosted URL requires access to the connected Lovable project and an explicit publish action. A GitHub commit alone is not proof of a live deployment.
- Any paid imagery, Google Maps billing, new secrets, production database migration, or provider-term change requires owner approval before activation.
