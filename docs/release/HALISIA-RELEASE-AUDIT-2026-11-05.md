# HALISIA release audit — 5 November 2026

Execution of ChatGPT's handoff of 5 November (stages 1–7). Updates
`HALISIA-RELEASE-AUDIT-2026-11-04.md`.

- **Release branch HEAD:** `d2899f9a741b5a7a70986d25d1ffe66e8bdf9c5c` (merge of #53).
- **Work branch:** `claude/halisia-ci-reliability-20261105`, which includes PR #54. **PR:** #55.
- **Live site:** build `2026-11-04.2`. This branch labels itself `2026-11-05.1`.

## Gate summary

| Feature           | Initial status                                        | Repair completed                                                                                         | Evidence                                                      | Final gate                                                                       |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| CI                | Quality job green; 109 / 108 browser tests            | Browser tests now run against the production build                                                       | Run 41892932922 (baseline); run for #55 not started (billing) | **BLOCKED**: GitHub Actions refuses to start jobs                                |
| Playwright        | 108 failures, 32 of them in protected Spatial specs   | Root cause found and fixed in CI config; 7 outdated specs updated                                        | Baseline log analysis (below)                                 | **BLOCKED** until CI runs                                                        |
| Explore           | Search and dossier depend on Lovable-only server keys | No app change needed                                                                                     | Baseline: `?q=Kisumu` stays on Nairobi in CI                  | UNVERIFIED (needs Lovable runtime or a phone check)                              |
| Passport          | Unit PASS; browser tests time out on the dev server   | Footer names the issuer (#54)                                                                            | Unit tests; live page shows the PDF button                    | UNVERIFIED in browser                                                            |
| Plot Planner      | Desktop PASS, phone timeouts                          | Street View on tap (#51)                                                                                 | Earlier runs                                                  | PASS desktop / UNVERIFIED phone                                                  |
| Cost intelligence | Cost and county PDFs PASS                             | —                                                                                                        | Baseline run                                                  | PASS                                                                             |
| Performance       | Intelligence dashboard chunk 1,403 kB                 | echarts panels (weather, timeline) load when their tab opens                                             | Before: CI build log of run 41892932922                       | **BLOCKED**: after-size needs a CI build                                         |
| Scout             | UNVERIFIED                                            | —                                                                                                        | `scout-hub` and `scout-pricing` unit tests pass               | **BLOCKED**: an end-to-end run needs test accounts and a non-production database |
| Voice             | UNVERIFIED, no tests                                  | 6 unit tests added (unsupported browser, Kenyan English voice, stop, long text, empty text, voice error) | `tests/unit/listen-button.test.tsx`                           | **BLOCKED** until CI runs; no device claim                                       |
| Security          | PASS (4 Nov, read-only)                               | Secret scan of tracked files; no new dependencies                                                        | See §4                                                        | PASS                                                                             |
| Release readiness | Release candidate                                     | —                                                                                                        | —                                                             | **BLOCKED** on CI and on the owner actions below                                 |

## 1. Stage 1: baseline diagnosis

Baseline CI run 41892932922 (on `d2899f9`):

- Quality job PASS: formatting, zero-warning lint, typecheck, 92 unit test files / 1,281 tests, development and production builds.
- Browser tests: 109 passed, 108 failed, 2 passed on retry.

### Root cause of most failures

Playwright started the app with `npm run dev`. On first visit the Vite dev server compiles hundreds of modules, so the page shows its server-rendered HTML for many seconds before React attaches. Clicks made in that window do nothing.

Evidence from the baseline log:

- The runtime diagnostic clicked Nairobi's Compare button and recorded `aria-pressed` as `"false"` both before and after, with no page errors.
- Passing plot-planner runs took 50–60 s.
- Passport tests never found `open-design-studio`, a button that renders unconditionally.

Real visitors receive the production build, which explains why the live site works.

**Fix:**

- CI now builds the production Node server (`NITRO_PRESET=node-server bunx vite build --mode production`), and Playwright tests it when `E2E_SERVER=prod`. Local runs keep the dev server.
- Production builds hash server-function ids with SHA-256. Test builds only (`E2E_READABLE_SERVER_FN_IDS=1`) keep readable ids, so the Passport fixture can recognise `getLocationIntel`. Production builds are unchanged.

### Failure classes (baseline, 108)

| Class                                       | Count                    | Examples                                                 | Action                                          |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| Protected Spatial specs                     | 32                       | `spatial*.spec.ts`                                       | Not touched (owner approval required)           |
| Un-hydrated dev pages (timing)              | Most of the rest         | Compare grid, globe intro, My location, Passport buttons | Production-build CI                             |
| Outdated expectations                       | 7 specs                  | See §2                                                   | Updated                                         |
| Lovable-only secrets                        | Several                  | Place search, AI report                                  | Expected in CI. Optional follow-up: route stubs |
| Lovable-hosted images (`/__l5e/assets-v1/`) | Theme and emblem visuals | Logo `naturalWidth` 0                                    | Expected in CI                                  |

## 2. Stage 2: outdated tests updated (each checked against the product change)

| Spec                            | Old expectation                     | Current intended behaviour                                        | Source of the change         |
| ------------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `waves-smoke`, `multi-location` | Tabs set `aria-selected`            | Tabs are toggle buttons with `aria-pressed`                       | `intelligence-dashboard.tsx` |
| `intelligence-engine-features`  | File named `halisia-intelligence-…` | `halisia-readings-…`                                              | `pdf-intelligence.ts`        |
| `pdf-dossier`                   | Contains "Investment scores"        | Scores removed; the test now asserts they never return            | Commit 831aacc               |
| `loading-ui`                    | Launch CTA opens `/explore`         | "Start with a point" scrolls to `#hero-map`                       | `routes/index.tsx`           |
| `00-runtime-diagnostics`        | Probes an SPA `#root`               | TanStack Start renders the whole document; probe `document.body`  | Framework                    |
| `counties-a11y-keyboard`        | Card itself toggles comparison      | Information card plus a separate keyboard-operable Compare button | `kenya-county-map.tsx`       |

No assertion was removed without a replacement that checks the current behaviour.

## 3. Stage 4: performance

- **Before:** `intelligence-dashboard-*.js` was 1,403.43 kB, with a 1,322.63 kB SSR twin (build log of run 41892932922). It is imported by Explore, Title deed and Report.
- **Cause:** `WeatherPanel` and `TimelinePanel` import `echarts-for-react` statically, but render only after their tab is opened. The default tab is Overview.
- **Change:** both load with `React.lazy` and a "Loading weather…" / "Loading timeline…" status. Server rendering is unaffected, because neither panel renders on the first paint.
- **After:** pending the next CI build log.

## 4. Stage 7: security and licensing

- **Read-only production checks (4 Nov, rolled back):**
  - RLS is enabled on every public table.
  - A non-admin account's attempt to grant itself `administrator` was refused ("Only confirmed allowlisted accounts may be administrators").
  - Signed-out visitors read 0 rows or are denied on private tables; a signed-in non-admin sees only their own profile.
- **Secret scan of tracked files:** no live keys or private keys. Matches were code reading `process.env.SUPABASE_SERVICE_ROLE_KEY` on the server, and a document describing scans. `.env` holds publishable Supabase values and browser map keys only.
- **Dependencies:** none added or changed (`package.json` and `bun.lock` untouched).
- **Model Lab licensing:** the six models load from `SpectraStudios/SourceCityToolkit_glb@main`, which is CC0-1.0 except for textures.com textures (not redistributable). They are unpinned. Re-hosting them with hashes needs owner approval.

## 5. Blockers

1. **GitHub Actions refuses to start jobs:** "recent account payments have failed or your spending limit needs to be increased". Every full run uses about 4 hours of runner time across six shards. A private repository's free monthly minutes run out quickly.
   - **Fix (owner):** make the repository public (Actions are free for public repositories; the owner already decided this), or update billing and raise the Actions spending limit.
2. **No local test run.** This environment cannot reach the npm registry or Lovable's package mirror, so tests run only in CI.
3. **Scout end to end** needs test accounts in a non-production database.

## 6. Owner-only actions

- Unblock GitHub Actions: make the repository public, or fix billing.
- Fix halisia.ai at the registrar (status, and the two Cloudflare nameservers). The .ai registry still lists none.
- Finish the Cloudflare Worker, then attach `halisia.ai` and `www.halisia.ai`.
- After approved merges, press **Publish → Update** in Lovable and confirm the served `halisia-build` meta tag.
- Phone-test the Passport PDF (Save card), the plot planner's "Show street photos", and Explore search with the dossier.
- Decide whether to re-host the six Model Lab models with hashes.

## 7. Release readiness

**Not ready to merge yet.** The changes in #55 are CI configuration, test updates, a lazy-load and unit tests. Their value can only be confirmed by a CI run. Once Actions runs:

1. Check that the production-build browser run starts; the new step is "Build the production Node server for browser tests".
2. Compare failures against the baseline 108.
3. Record the after-size of the intelligence dashboard chunk.
4. Then mark #55 ready for review.

## 8. Follow-up: first production-build run and test stand-ins (5 Nov, afternoon)

The first browser run against the production build (release `f6497fa`, after #55 and with the repository public) gave **131 passed, 82 failed, 1 passed on retry**, against the dev-server baseline of 109 / 108. The Compare button now responds on the first click, which confirms the hydration root cause.

### Why the 82 failed

Diagnosed with temporary probe runs on `claude/e2e-probe-*` branches (they changed no app code and are not part of the PR).

| Cause                                                                                                                                                                    | Tests                                          | Action                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| The CI server has no Supabase variables or Lovable keys, so geocoding, location intelligence and reverse geocoding return errors                                         | Explore journeys, Passport, compare, map click | Test stand-ins (below)                                                           |
| The Passport fixture answered in plain JSON; the client only reads TanStack's serialized format                                                                          | Passport evidence ×3                           | Fixture uses the real wire format                                                |
| The synthetic session was stored under a key the Supabase client never reads                                                                                             | Passport evidence                              | Key derived from the build's Supabase URL                                        |
| Design Studio specs used the default map centre, which the Passport rightly refuses                                                                                      | Design Studio ×2                               | Use a deliberate test point                                                      |
| Specs written for removed features: floating search and Ctrl+K (removed 27 Sep, `0579826`), landing My Location, scored modules, grades and foundation cards (`8bbad9b`) | Search, geolocation, intelligence, geotech     | Specs follow the current screens and assert the withdrawn features do not return |
| Protected Spatial specs (empty parcel list without an authorised account)                                                                                                | about 31                                       | Not touched                                                                      |
| Lovable-hosted images (`/__l5e/assets-v1/`) and visual snapshots                                                                                                         | about 15                                       | Expected in CI                                                                   |
| Throttled first paint 26.8 s against a 20 s budget                                                                                                                       | 2                                              | Open; see defects                                                                |

### Test stand-ins

`tests/e2e/helpers/server-fns.ts` answers `geocodeAddress`, `reverseGeocode` and `getLocationIntel` with synthetic data labelled "test fixture" or "not real evidence", serialized exactly as the production server does (seroval with `x-tss-serialized`). Every other server call still reaches the test server. Nothing is stored or used as evidence. Production builds are unchanged.

### Defects found by the new runs

| #   | Severity | Defect                                                                                                                                                                                    | Status                                                                                                                         |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 12  | P2       | The compare page said "3 measured" but listed every module as "Not assessed", and claimed HALISIA held no data for 10 of 10 modules                                                       | Fixed: measured modules read "Measured", and the panel explains that nothing is subtracted because HALISIA publishes no scores |
| 13  | P2       | On the GIS layers map, the Back button covered the "Distance" measuring tool, so it could not be tapped                                                                                   | Fixed: that map leaves out Back, as the county map already does                                                                |
| 14  | P2       | A tap made before the page finishes loading can be undone when the router takes over ("Start with a point" returned to the top; the Passport's Design Studio link stayed on the Passport) | Open: specs wait for hydration; needs a router-level fix and a phone check                                                     |
| 15  | P3       | Home page first paint under throttled mobile conditions: 26.8 s against a 20 s budget                                                                                                     | Open: performance follow-up                                                                                                    |

### Targeted results before the full run (desktop, production build)

PASS: Explore amenities, geotech, dossier PDF and progress, Kisumu / Mombasa / Nairobi journeys, terrain, provenance export, map click, landing map search, Explore search, the guided tour, the intelligence panel and its PDF, compare, all five Passport evidence specs, and both Design Studio specs. The full six-shard result for this PR is recorded in the PR.
