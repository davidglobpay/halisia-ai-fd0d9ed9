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

## 8. Update — 6 November 2026: 3D site viewer (PR #61)

Work branch `chatgpt/site-furniture-retry-20261106` (PR #61, draft), brought up to date with the release branch by a merge commit (no rebase). BUILD_ID `2026-11-06.5`. Evidence is GitHub Actions output; no local package install was possible in the Claude environment.

| Area                  | Finding                                                                                                                                                                                | Fix                                                     | Evidence                                                                                                                          | Gate                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| CI quality job        | Lint failed on the release branch since PR #57 (2 `no-unused-expressions` errors in `site-house.ts`, 2 unused disable directives), so typecheck, unit tests and builds never ran in CI | Statement blocks; directives removed                    | Run 42235689664 onward: prettier, eslint (0 warnings), typecheck, 96 files / 1,311 unit tests, dev and production builds all pass | PASS                      |
| Sofa load retry       | A failed `sofa.glb` request was cached as `null` for the session                                                                                                                       | Cache cleared on failure (ChatGPT, e41896a)             | Fallback e2e test: boxes stay, frame drawn, no page errors                                                                        | PASS                      |
| Frame-time watch      | Frames over 250 ms were ignored and 180 frames were needed, so a device drawing 1–3 frames a second was never judged                                                                   | Time-based 3 s window                                   | Phone emulation at 4x CPU: pixel ratio fell 2 → 1, frame time 1,489 → 627–650 ms (software GPU, not a phone)                      | PASS (emulation only)     |
| Best picture by hand  | The watch switched it off again within 3 s of the person ticking it                                                                                                                    | A hand-made choice is kept; only pixel density may drop | Fallback test turns it on and it stays on                                                                                         | PASS                      |
| Exports               | —                                                                                                                                                                                      | —                                                       | PDF 243,200 bytes, 4 pages, `%PDF-`; GLB 1,097,704 bytes, glTF 2, length matches, 298 meshes, 5 images                            | PASS                      |
| Plot Planner          | Walk link quotes numbers (`lat=%22-1.502157%22`); the Model Lab still reads it                                                                                                         | Not changed (router behaviour; cosmetic)                | Inspiration panel, synthetic photo read on device, walk link opens the viewer                                                     | PASS, cosmetic issue open |
| Sofa GLB optimisation | Download and use of `gltfpack` was refused by the Claude environment's safety check                                                                                                    | Not attempted; asset unchanged (216,632 bytes)          | —                                                                                                                                 | BLOCKED                   |

### Sizes (production build, gzip)

| Chunk                               | 5 Nov (run 42027864216) | 6 Nov (run 42239875812) |
| ----------------------------------- | ----------------------- | ----------------------- |
| `site-viewer.internal`              | 25.99 kB                | 36.62 kB                |
| `render-quality` (loaded on demand) | —                       | 13.70 kB                |
| `GLTFLoader` (loaded on demand)     | 12.90 kB                | 12.90 kB                |
| `model-lab` route                   | 5.51 kB                 | 5.70 kB                 |
| `plot-planner` route                | 5.20 kB                 | 5.40 kB                 |
| `plot-viewer.internal`              | 4.09 kB                 | 4.43 kB                 |

Assets: `sofa.glb` 216,632 bytes; `sky-day.hdr` 374,622 bytes (was 1,477,951 in PR #58). In CI both downloaded in under 35 ms from the local server, about 10–13 s after navigation (after the viewer's first frame at 0.8–2.0 s).

### Not verified

Physical phones and real GPUs (CI uses a software GPU); the live Lovable site with these changes (not published); the pre-existing browser-test failures in other areas (about 75 per run before and after this work, in Spatial, Passport, Intelligence, search and visual snapshots).
