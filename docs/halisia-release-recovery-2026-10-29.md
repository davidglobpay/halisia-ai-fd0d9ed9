# HALISIA.AI: release recovery, QA and production readiness (29 Oct 2026)

- **Branch:** `claude/halisia-release-recovery-20261029`
- **Base:** `codex/reconciled-release-20261015` @ `0071e95` (merge of PR #35)
- **Build marker:** `BUILD_ID = "2026-10-28.2"` (`src/lib/build-info.ts`)
- **Scope:** static audit, focused fixes, regression tests and evidence recording.
- **What this session did not do:** merge, publish, deploy, Lovable calls, production database or storage changes, or paid API calls.

## Verdict: **DO NOT PUBLISH**

Every mandatory gate is **UNVERIFIED**:

- Install
- Format
- Lint
- Typecheck
- Full unit suite
- Production build
- Playwright E2E
- SQL security regression

No GitHub Actions job has started on this repository since at least 22 Oct. The cause is a billing or spending-limit failure on the account, not the code. PRs #33, #34 and #35 were merged into the release branch with **zero** CI evidence.

The code changes in this branch are low risk and covered by focused tests. That does not replace the full gate run. The verdict changes to **PUBLISH WITH CONDITIONS** when:

1. GitHub billing is fixed.
2. `ci.yml` passes on this PR's head.
3. _Manual branch validation_ passes against `codex/reconciled-release-20261015` after the merge.
4. The three owner actions in §6 are completed or explicitly accepted.

## 1. Baseline evidence (Phase A)

| Item                    | Finding                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release head            | `0071e95`. It moved from `e85a85c` during this session when PR #35 merged. 1,991 commits in total (full clone).                                                                                                                     |
| Routes                  | 55 route files under `src/routes`: 17 authenticated pages plus the `_authenticated/route.tsx` guard, 2 API (`api/chat.ts`, `api/public/hooks/pulse-refresh.ts`), plus `mcp.ts` and OAuth metadata.                                  |
| Server functions        | 33 `createServerFn` endpoints in 23 files. 31 were tabulated: 24 require `requireSupabaseAuth`, 4 are admin-gated by `has_role`, and 30 declare input validation. The table is in `docs/halisia-feature-validation-matrix.md`.      |
| Migrations since 20 Oct | `20261028190000_label_sample_listings.sql` and `20261029190000_project_spine_and_evidence_read.sql` (PR #35; additive: new tables, RLS, nullable FK columns). Whether either is applied to production: **UNVERIFIED**.              |
| Unit tests              | 84 test files in `tests/unit` at base (85 with the new one in this branch).                                                                                                                                                         |
| E2E                     | 39 Playwright specs in `tests/e2e`.                                                                                                                                                                                                 |
| SQL tests               | `tests/sql/security-regression.sql` and `tests/sql/project-access.sql`.                                                                                                                                                             |
| Workflows               | `ci.yml` (push to `main` and `pull_request` only) and `manual-validation.yml` (dispatch).                                                                                                                                           |
| Open PRs                | #32 (`fix/halisia-date-window-audit-20261028` → `main`): dirty, 198 files, not mergeable. **Superseded by this branch; close it.**                                                                                                  |
| CI                      | The last 5 runs (#33, #34, #35, two `main` pushes) all concluded `failure` with 0 steps executed. Annotation: _"The job was not started because recent account payments have failed or your spending limit needs to be increased."_ |

## 2. Gate results (Phase B)

| Gate                    | Command                                           | Result                      | Evidence                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install                 | `bun install --frozen-lockfile`                   | **UNVERIFIED**              | Sandbox: bun `DNSResolveFailed` for registry.npmjs.org; npm 403 through the proxy.                                                                                                                                                                        |
| Format                  | `bun run format:check`                            | **UNVERIFIED** (full repo)  | Changed files pass `prettier --check` with the repo's `.prettierrc`.                                                                                                                                                                                      |
| Lint                    | `bun run lint` (`--max-warnings=0` in CI)         | **UNVERIFIED**              | Repo ESLint plugins can't be installed here.                                                                                                                                                                                                              |
| Typecheck               | `bun run typecheck` (`tsgo --noEmit`)             | **UNVERIFIED**              | `tsc --strict` on the patched cost-intel files against stub modules: only stub-induced errors (`process` types, middleware context).                                                                                                                      |
| Unit tests              | `bun run test:unit`                               | **UNVERIFIED** (full suite) | Focused run (vitest-compatible shim, `tsx`): all 90 cost-intel tests pass across 5 files (33 new); `price-relevance` 15/15; `evidence-observation` 12/12; `passport-pdf-quality` 26/26. See §5.                                                           |
| Build                   | `vite build` (production)                         | **UNVERIFIED**              | Dependencies unavailable.                                                                                                                                                                                                                                 |
| E2E                     | `bun run test:e2e`                                | **UNVERIFIED**              | Dependencies and app server unavailable.                                                                                                                                                                                                                  |
| SQL security regression | `tests/sql/*.sql`                                 | **UNVERIFIED**              | Not run: it writes to a database, and production is out of scope.                                                                                                                                                                                         |
| CI on PR                | `ci.yml`                                          | **UNVERIFIED**              | GitHub Actions billing block.                                                                                                                                                                                                                             |
| Secret scan (history)   | pattern scan of `git log --all -p`, 1,991 commits | **PASS** (pattern level)    | 0 hits for Stripe, OpenAI-style, AWS, GitHub, Slack, PEM private keys and Supabase `sb_secret_`. No service-role JWTs. The one `SERVICE_ROLE_KEY =` hit reads `process.env` (false positive). One distinct Google `AIza` browser key is present (see §6). |
| Device AR/VR            | —                                                 | **UNVERIFIED**              | No physical-device evidence. Nothing in this report claims device success.                                                                                                                                                                                |

## 3. Fixes in this branch (Phase C)

### R1: Canonical 12-month observation window for land prices (Medium)

**Before.** The window had only a lower bound:

- `src/lib/cost-intel.functions.ts:37` (`windowStart`)
- `src/lib/cost-intel.functions.ts:51` (`.gte("observed_date", windowStart())`)

So future-dated rows stayed median-eligible indefinitely and could become `newestDate`. The pure summarizers (`src/lib/cost-intel.ts:76`, `summarizeLandPrices`) never checked dates at all.

**After.**

- **`src/lib/cost-intel.ts`:**
  - `parseIsoDateUtc` (strict calendar check)
  - `observationWindow(asOf)` (inclusive, UTC, month-end clamped)
  - `isWithinObservationWindow`
- **`summarizeLandPrices`, `wardLandOptions` and `resolveLandPriceSummary`** take `opts.asOf`. Out-of-window rows are excluded from the median **and** from the index cross-check. Malformed dates are always excluded.
- **`fetchObservations`** now applies `gte(start)` and `lte(end)`. Both endpoints pass one `asOf` to the query and the summarizer.
- **Unchanged rules:**
  - source whitelist
  - `include_in_median === true`
  - index rows are a cross-check only
  - n ≥ 5
  - ward → sub-county → county fallback
  - no fallback prices

### R2: CSV import rejects impossible and future dates (Medium)

**Before.** `validateCsvRow` (`src/lib/cost-intel.functions.ts:354`, regex at `:387`) accepted any `NNNN-NN-NN`, including `2026-02-30` and future dates.

**After.** `validateCsvRow(table, row, today = new Date())` returns:

- `observed_date must be a real date in YYYY-MM-DD form`
- `observed_date must not be in the future`

### R3: Manual validation default ref (Low)

`.github/workflows/manual-validation.yml:9` defaulted to `fix/halisia-production-stability`. It now defaults to `codex/reconciled-release-20261015`.

### Interaction with PR #35

PR #35 added `price_county` to BoQ lines and `price-relevance.ts`. My changes were 3-way merged onto `0071e95` without conflict. Both features are present, and all cost-intel and price-relevance tests pass under the shim.

## 4. Static audit findings, not fixed here

| #   | Severity      | Finding                                                                                                                                                                                                                                                                                                    | Location                                                                        |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| S1  | Medium        | `synthesizeArticleAudio` lets **any signed-in user** trigger paid TTS (ElevenLabs, Azure or Google). It has no rate limit, no cache and an identity validator (`input => input`): `articleId` and `engine` are unchecked. This is inconsistent with f743268 ("Validate inputs to eight server functions"). | `src/lib/pulse.functions.ts:81-83`                                              |
| S2  | Low           | The cron secret is compared with `!==`, which is not constant-time. It is fail-closed when unset, which is good.                                                                                                                                                                                           | `src/routes/api/public/hooks/pulse-refresh.ts:18`                               |
| S3  | Withdrawn     | Retracted on 30 Oct: the "Admin-only manual refresh" docblock sits above `runPulseIngestion`, which is admin-only. The finding was a misread.                                                                                                                                                              | —                                                                               |
| S4  | Low (hygiene) | `READ-ME-FIRST.md` tells contributors to commit to `main` and claims "CI should be green on the first tick". Both are false today.                                                                                                                                                                         | `READ-ME-FIRST.md:40,135`                                                       |
| S5  | Low (tests)   | The test fixture for `rankBudgetOptions` omits the required `scope` field. It isn't caught because the repo `tsconfig.json` doesn't include `tests/`.                                                                                                                                                      | `tests/unit/cost-intel.test.ts:142`                                             |
| S6  | Info          | `ci.yml` runs only on `main` pushes and on PRs. Release-branch pushes (all Lovable syncs) get no checks unless a PR is open.                                                                                                                                                                               | `.github/workflows/ci.yml:7-9`                                                  |
| S7  | Info          | `dangerouslySetInnerHTML` is used only in the shadcn chart style block (static theme CSS).                                                                                                                                                                                                                 | `src/components/ui/chart.tsx:73`                                                |
| S8  | Info (OK)     | The new `projects` and `project_members` tables enable RLS, use restrictive active-account policies, and have SECURITY DEFINER helpers with `search_path ''`. The owner guard trigger is present.                                                                                                          | `supabase/migrations/20261029190000_project_spine_and_evidence_read.sql:42-121` |
| S9  | Info (OK)     | The service-role client is imported only from server modules: `client.server.ts`, `pulse.functions.ts` (dynamic import), `intel-snapshot.server.ts` and `pulse/ingest.server.ts`.                                                                                                                          | —                                                                               |
| S10 | Info (OK)     | Unauthenticated endpoints (`getElevationSamples`, `getGeotechIntel`, `generateNarrative`, `passportLocationNews`, cost-intel reads) call only free providers or deterministic code, and all validate input.                                                                                                | —                                                                               |

**Passport PDF.** The defects from the 28 Oct PDF review are addressed in code:

- `driveTime` never prints "~0 min" (`src/lib/passport-pdf-quality.ts:144`).
- Sections flow instead of always forcing a new page (`src/lib/passport-pdf.ts:279`).
- Filtered amenities drive both the cards and the access directory (`passport-pdf-quality.ts:63,147`).
- News is deduplicated (`:217`).

`passport-pdf-quality` passes 26/26 under the shim. A real Google-backed export is **UNVERIFIED**.

## 5. Test evidence detail

Harness: `tsx` with a minimal vitest-compatible shim and stubs for `@tanstack/react-start`, `@supabase/supabase-js` and `@/integrations/supabase/*`. It is **not** the project's vitest and does not count as the unit gate.

| File                                              | Result |
| ------------------------------------------------- | ------ |
| `tests/unit/cost-intel-date-window.test.ts` (new) | 33/33  |
| `tests/unit/cost-intel.test.ts`                   | 22/22  |
| `tests/unit/cost-intel-final.test.ts`             | 16/16  |
| `tests/unit/cost-intel-helpers.test.ts`           | 10/10  |
| `tests/unit/cost-intel-prepublish.test.ts`        | 9/9    |
| `tests/unit/price-relevance.test.ts`              | 15/15  |
| `tests/unit/evidence-observation.test.ts`         | 12/12  |
| `tests/unit/passport-pdf-quality.test.ts`         | 26/26  |

The new tests use a fixed reference date, `2026-10-27T12:00Z`. They cover:

- the inclusive boundary day (`2025-10-27` counted, `2025-10-26` excluded)
- future, empty, malformed and impossible dates
- stale rows not moving the median or `newestDate`
- index-only data and stale index rows
- `include_in_median: false`
- tier fallback skipping stale tiers
- the budget planner gate
- CSV rejections

Other suites were not counted: under the shim, failures came from unimplemented matchers, React, Three.js or jsPDF dependencies, or source files outside `src/lib`, so they say nothing about the product.

## 6. Owner actions (blocking or conditional)

1. **Fix GitHub billing** (Settings → Billing & plans; resolve the failed payment or raise the Actions spending limit). Then re-run CI on this PR. **Blocking.**
2. Once CI is green, run **Actions → Manual branch validation** on `codex/reconciled-release-20261015`. **Blocking.**
3. Confirm the `20261029190000` migration is applied in Lovable Cloud and that `tests/sql/project-access.sql` passes on a non-production database. **Blocking for Projects.**
4. Restrict the Google Maps browser key in Google Cloud Console to HTTP referrers (`halisia.ai/*`, `*.lovable.app/*`) and the Maps APIs in use. **Condition.**
5. Decide S1: gate TTS to administrators, or add per-user rate limiting and caching. **Condition** (cost exposure).
6. Close PR #32 as superseded. **Housekeeping.**

## 7. Top 10 issues

| #   | Issue                                                                   | File:line                                         | One-line fix                                                                                        |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Actions never start (billing), so there is no CI evidence for any merge | `.github/workflows/ci.yml:1`                      | Fix GitHub billing/spending limit, then re-run CI on this PR.                                       |
| 2   | Land-price window has no upper bound, so future rows count              | `src/lib/cost-intel.functions.ts:51`              | **Fixed here:** `.gte(start).lte(end)` from `observationWindow(asOf)`.                              |
| 3   | Summarizers ignore dates entirely                                       | `src/lib/cost-intel.ts:76`                        | **Fixed here:** `opts.asOf` window filter in all three summarizers.                                 |
| 4   | CSV import accepts future and impossible dates                          | `src/lib/cost-intel.functions.ts:387`             | **Fixed here:** strict calendar and not-in-future checks.                                           |
| 5   | Any signed-in user can trigger paid TTS, unvalidated                    | `src/lib/pulse.functions.ts:83`                   | Add a zod validator (uuid, engine enum) plus a `has_role` check or a per-user rate limit and cache. |
| 6   | Release-branch pushes get no CI                                         | `.github/workflows/ci.yml:7`                      | Add `codex/reconciled-release-20261015` to `push.branches`.                                         |
| 7   | Manual validation defaults to a dead branch                             | `.github/workflows/manual-validation.yml:9`       | **Fixed here:** default is the release branch.                                                      |
| 8   | Unrestricted-looking Google browser key tracked in `.env`               | `.env:4`                                          | Restrict by referrer and API in Google Cloud Console. Keep the file Lovable-managed.                |
| 9   | Contributor doc says commit to `main`                                   | `READ-ME-FIRST.md:40`                             | Delete or replace it with a pointer to this doc and the branch policy.                              |
| 10  | Non-constant-time cron secret compare                                   | `src/routes/api/public/hooks/pulse-refresh.ts:18` | Use `crypto.timingSafeEqual` on equal-length buffers.                                               |

## 7a. Follow-up on 30 Oct (branch `claude/halisia-hardening-20261030`)

PRs #36 and #37 were merged on 29 Oct, still without CI. The follow-up branch addresses issues 5, 6, 9 and 10 and test finding S5:

| Issue              | Change                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5: paid TTS        | `synthesizeArticleAudio` now validates input with `parseTtsInput`: the article id must be a UUID and the engine must be `elevenlabs`, `azure` or `google`. Each signed-in account is limited to 20 cloud-voice calls per hour per server instance. The limit is best-effort and process-local. The browser already caches audio per article and engine. |
| 6: CI trigger      | `ci.yml` also runs on pushes to `codex/reconciled-release-20261015`.                                                                                                                                                                                                                                                                                    |
| 9: contributor doc | `READ-ME-FIRST.md` deleted.                                                                                                                                                                                                                                                                                                                             |
| 10: cron secret    | The Pulse cron hook compares SHA-256 digests (Web Crypto, Workers-compatible) with a constant-time byte loop (`src/lib/cron-secret.server.ts`). It still fails closed when the secret is unset.                                                                                                                                                         |
| Public coordinates | `getWave4Intel` and `getWave4Overlays` reject non-finite and out-of-range lat/lng, and honour only a boolean `refresh: true`.                                                                                                                                                                                                                           |
| S5: test fixture   | The `rankBudgetOptions` fixture now carries `scope`.                                                                                                                                                                                                                                                                                                    |

Evidence:

- `node --test tests/pulse-check.node.test.mjs`: 4/4 pass on real Node. The harness now injects the comparison helper.
- New `tests/unit/request-guards.test.ts`: 14/14 under the shim.
- Cost-intel and price-relevance suites still pass under the shim.
- Changed files pass `prettier --check`.
- All mandatory gates remain **UNVERIFIED** until GitHub billing is fixed.

## 8. Not verified and not claimed

- Full lint, typecheck, unit, build and E2E gates.
- CI on any commit.
- The production deployment and live `BUILD_ID`.
- Whether the migrations are applied.
- Branch protection settings (the API is blocked through the proxy).
- A signed-in Google-backed Passport export.
- iOS Quick Look and Android Scene Viewer or WebXR on physical devices.
- Current database contents. The last read was 27 Oct: 0 future-dated land rows.
