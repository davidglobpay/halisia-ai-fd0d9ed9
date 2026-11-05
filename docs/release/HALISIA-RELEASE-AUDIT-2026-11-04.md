# HALISIA release audit — 4 November 2026

Branch `codex/reconciled-release-20261015`, audited at `d2899f9` (8 commits after
`d3d8054`). Live site `halisia-ai.lovable.app` serves build `2026-11-04.2`
(read from the `halisia-build` meta tag on 4 Nov, 22:04 EAT).

This file consolidates the six documents the Codex master task asked for
(feature audit, defect register, Model Lab validation, test results, open-stack
readiness, release readiness). One file keeps the evidence in one place and
avoids six documents drifting apart.

Gate words: **PASS** means tested with evidence below. **UNVERIFIED** means not
tested end to end; it is not a failure. **BLOCKED** means a named dependency is
missing. **N/A** means the feature does not exist yet, by design.

## 1. Test results

| Check               | Command (CI)                                     | Result                                    | Evidence                                            |
| ------------------- | ------------------------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| Formatting          | `bun run format:check`                           | PASS                                      | CI run 41892932922                                  |
| Lint, zero warnings | `bunx eslint . --max-warnings=0`                 | PASS                                      | same run                                            |
| Typecheck           | `bun run typecheck`                              | PASS                                      | same run                                            |
| Unit tests          | `bunx vitest run`                                | PASS: 92 files, 1,281 tests               | same run                                            |
| Builds              | `vite build` (development and production)        | PASS                                      | same run                                            |
| Browser tests       | `playwright test`, 6 shards, desktop and Pixel 5 | 109 passed, 108 failed, 4 passed on retry | PR #49 run, 3 Nov; same app code apart from wording |

The local workspace cannot reach the npm registry, so every command above ran
in GitHub Actions on the real lockfile. No lockfile was changed.

### Why browser tests fail, by cause

| Cause                                                                                             | Examples                                                                                                | App defect?               |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| Server features use Lovable-only secrets (`LOVABLE_API_KEY`, `GOOGLE_MAPS_API_KEY`), absent in CI | Place search (`?q=Kisumu` stays on Nairobi), AI report, Explore dossier                                 | No: CI environment        |
| Images on Lovable's file host (`/__l5e/assets-v1/…`) 404 on the CI dev server                     | Logo, county emblems, theme screenshots                                                                 | No: CI environment        |
| Tests written for earlier designs                                                                 | `#root` hydration probe, county cards as compare toggles, intelligence PDF filename, landing CTA target | No: stale tests           |
| Large pages compile slowly on the CI dev server                                                   | Passport PDF, plot-planner drag (pass on some runs)                                                     | No: test timeouts         |
| Protected Spatial specs, where the parcel list is empty without an authorised account             | `spatial*.spec.ts`                                                                                      | No: access rules (see §3) |

## 2. Feature audit

| Feature                                                                        | Route                    | Status                                             | Evidence / note                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage, menu, tools rail                                                     | `/`                      | PASS                                               | Every route shell renders without an uncaught exception on desktop and phone (`guarded-release.smoke`); menu labels and hints are live (build 2026-11-04.2)                                  |
| Land search                                                                    | `/explore`               | UNVERIFIED                                         | Depends on Lovable-hosted geocoding; check on the live site                                                                                                                                  |
| Land Passport page                                                             | `/passport`              | PASS (render) / UNVERIFIED (data)                  | Live page lists findings, the evidence ledger and links to Design Studio and the plot planner                                                                                                |
| Land Passport PDF                                                              | `/passport`              | PASS (unit) / UNVERIFIED (device)                  | Logo header, H watermark on every page, page numbers; footer now names "HALISIA AI \| Land Passport"; foundation advice requires a licensed site investigation; sources and dates per figure |
| Other PDFs (cost estimate, county comparison, dossier with maps, slow network) | various                  | PASS                                               | Browser tests download them on desktop and phone through the "Your PDF is ready – Save" card                                                                                                 |
| Maps / GIS                                                                     | many                     | PASS (controls) / UNVERIFIED (Google layers in CI) | Floating controls and layer menu tested on the plot planner; ArcGIS licensed imagery key in `src/config/public-browser-keys.ts`                                                              |
| Plot planner                                                                   | `/plot-planner`          | PASS on desktop / UNVERIFIED on a real phone       | Renders, layer menu, imagery-failure message; Street View loads only on tap (fixes the getRootNode page error)                                                                               |
| Cost calculator / budget                                                       | `/build-cost`, `/budget` | PASS (unit, data)                                  | 42 priced combinations imported and checked against the expected totals (31 Oct)                                                                                                             |
| AI intelligence                                                                | various                  | UNVERIFIED                                         | Needs Lovable AI credits; see §5 risk                                                                                                                                                        |
| Model Lab                                                                      | `/model-lab`             | PASS for current scope (§4)                        | Protected renderer, not modified                                                                                                                                                             |
| Spatial AR/VR                                                                  | `/spatial`               | PASS (access) / UNVERIFIED (device)                | Protected; signed-out visitors now see why Search is empty                                                                                                                                   |
| Scout                                                                          | `/scout`, `/admin`       | UNVERIFIED                                         | Tables exist with RLS; no simulated end-to-end run yet                                                                                                                                       |
| Marketplace                                                                    | `/marketplace`           | PASS (render)                                      | Map view needs at least one listing                                                                                                                                                          |
| Payments                                                                       | —                        | N/A                                                | No payment SDK in the project; the pricing page states checkout is not live                                                                                                                  |
| Admin                                                                          | `/admin`                 | PASS (authorisation)                               | See §3                                                                                                                                                                                       |
| Voice reader                                                                   | data tiles               | UNVERIFIED                                         | "Listen" buttons present; no device test                                                                                                                                                     |

## 3. Security (P0) — PASS

All checks ran read-only against the production database by simulating roles
inside a transaction that always rolls back. Nothing was written.

- **Row-level security:** enabled on every `public` table. No permissive write
  policy open to `anon` or `public`. No public storage bucket.
- **Privilege escalation:** a real non-admin account tried to insert
  `administrator` into `user_roles` and was refused with "Only confirmed
  allowlisted accounts may be administrators". Its attempt to update roles
  changed 0 rows. The `halisia_active_account` policy is RESTRICTIVE, so it
  cannot widen access.
- **Signed-out reads:** profiles and the admin tables are denied. Roles,
  financing, vault, transactions, payouts, leads, parcels, contributions, saved
  items, report shares, insurance and professional requests all return 0 rows.
- **Signed-in non-admin reads:** own profile only (1 of 5), 0 of 3 parcels, 0 of
  2 admin audit events.
- **Limit:** most private tables are still empty, so cross-user leaks on those
  tables could not be observed with real rows.

## 4. Model Lab and Blender — Codex claims checked

- `public/architectural-model-manifest.csv` (30 "pending" rows) is **not read by
  any code**. It is a wishlist, not a release blocker.
- The live Model Lab loads six models at runtime from
  `SpectraStudios/SourceCityToolkit_glb` on `main`. That repository is
  **CC0-1.0**, except that models using textures.com textures are not covered
  by CC0 and those textures may not be redistributed. HALISIA links to the files
  and does not re-host them.
- **Risk:** `main` is unpinned (`ASSET_IMMUTABILITY = "UNAVAILABLE"`), so the
  upstream files can change or disappear.
- **Recommendation:** copy the six GLBs into HALISIA storage with recorded
  SHA-256 hashes, after confirming which ones use textures.com textures. This
  needs owner approval because it touches the protected Model Lab.
- **Blender pipeline** (`scripts/blender-prepare.py`): not needed for this
  release. No new source models exist to prepare, and the current models are
  used as authored. Revisit when HALISIA commissions or sources its own models.

## 5. Open-source enhancements (Codex Stage H) — classification

| Item                                 | Classification           | Reason                                                                                                 |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Blender headless pipeline            | FUTURE                   | No new models to prepare yet                                                                           |
| glTF Transform / meshopt derivatives | READY FOR ISOLATED PILOT | Four Model Lab files are 17–29 MB; compression would help phones. Needs owner approval (protected)     |
| Poly Haven HDRIs                     | FUTURE                   | Lighting already works; CC0, low risk                                                                  |
| MapLibre                             | REJECT for now           | Google maps, Leaflet and ArcGIS imagery already cover the need; adding a fourth map engine adds weight |
| CesiumJS pilot                       | REJECT                   | Already in the app (3D globe)                                                                          |
| 3D Tiles streaming                   | FUTURE                   | Google Photorealistic 3D Tiles needs a paid key; planned as phase 2 of the plot planner                |
| Open3D / Potree point clouds         | FUTURE                   | No Scout point-cloud data exists yet                                                                   |
| Three.js XR audit                    | BLOCKED                  | Needs a physical ARCore phone and an iPhone; no device evidence can be fabricated                      |

## 6. Defects found and fixed in this cycle

| #   | Severity | Defect                                                                       | Fix                                             |
| --- | -------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | P0       | Only the first PDF downloaded on Android (Chrome's automatic-download block) | PR #49: Save card for slow exports              |
| 2   | P1       | Taps blocked by decorative glow layers (e.g. "Start with a point")           | PR #48                                          |
| 3   | P1       | Map controls showed through dialogs and the guide                            | PR #48                                          |
| 4   | P1       | Plot planner page error `getRootNode`                                        | PR #48 (sizing) and PR #51 (Street View on tap) |
| 5   | P1       | Explore map, budget planner and plot planner missing from the menu           | PR #49, PR #50                                  |
| 6   | P1       | ArcGIS key wiped by Lovable's `.env` rewrite                                 | PR #48 (config file)                            |
| 7   | P2       | Passport Contents page drew a hidden duplicate header                        | PR #44                                          |
| 8   | P2       | Spatial Search greyed out with no reason when signed out                     | PR #49                                          |
| 9   | P2       | Home page wording contradicted itself ("Eight ways", "seven gaps")           | PR #53                                          |
| 10  | P2       | Build label stuck at 2026-10-31.1                                            | PR #52                                          |
| 11  | P3       | Passport PDF footer did not name the issuer                                  | This PR                                         |

### Open issues

- **halisia.ai does not resolve.** The .ai registry has no nameservers on record
  about 8 hours after the change at the registrar. Owner action needed at the
  registrar (status and nameservers).
- **Server features depend on Lovable credits and Lovable Cloud.** AI features
  fail at zero credits, and the database pauses if the monthly Cloud allowance
  runs out. Watch Lovable → Cloud → Overview.
- **The intelligence dashboard chunk is about 1.4 MB of JavaScript**, heavy on
  phones. Code-splitting is a P2 follow-up.
- **The Cloudflare "Workers Builds" check fails on every commit.** It is
  unrelated to the live site; disconnect it or configure it.
- **Stale browser tests** (§1) should be updated to the current designs so CI can
  go green. This is a test-only task and needs no app change.

## 7. Release readiness

**Verdict: release candidate for owner review, not "production-ready".** No
P0 defect remains open. AI outputs, Scout end to end, voice and real-device XR
are UNVERIFIED, and the custom domain is not live.

- **Deploy:** merge to the release branch, then use Lovable **Publish → Update**,
  then confirm the live `halisia-build` meta tag matches `src/lib/build-info.ts`.
- **Rollback:** Lovable version history (restore the previous edit), or revert
  the merge commit on GitHub and publish again.
- **Before telling users:** do a phone run of the Passport PDF, the plot planner's
  "Show street photos", and the Explore search plus dossier on the live site.
