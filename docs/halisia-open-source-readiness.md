# HALISIA.AI: open-source readiness (29 Oct 2026)

- **Base:** `codex/reconciled-release-20261015` @ `0071e95`
- **Scope:** static review of the tracked tree and the full git history (1,991 commits).
- **What this document is not:** a legal opinion, or a decision to open-source.

## Verdict: **NOT READY to make public**

The code itself does not leak server secrets. The repository still needs licence and hygiene work, PII removal and an owner decision before it is made public. Making it public also exposes the **whole git history**, so anything below that is in history needs a history rewrite. That conflicts with the Lovable rule in `AGENTS.md`. The safer path is a **fresh public repository** seeded from a cleaned snapshot.

## 1. Secrets

| Check                                                                                                                                              | Result                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server secrets in history (Stripe `sk_live_`, OpenAI-style `sk-`, AWS `AKIA`, GitHub `ghp_`, Slack `xox`, PEM private keys, Supabase `sb_secret_`) | **0 hits**                                                                                                                                                                                                      |
| Supabase service-role JWT in history                                                                                                               | **None**. The one `SERVICE_ROLE_KEY =` match reads `process.env` (false positive).                                                                                                                              |
| Tracked `.env`                                                                                                                                     | Present. It holds 8 public-by-design variables: the Supabase URL, project id and **publishable** key, and the Google Maps **browser** key and tracking id. It isn't in `.gitignore` because Lovable manages it. |
| Google browser key (`AIza…`)                                                                                                                       | 1 distinct key in history. It is public by design in a browser bundle, but it **must be restricted** by HTTP referrer and API before publication, or anyone can bill Maps calls to the account.                 |
| Server-only env access                                                                                                                             | The service-role client lives only in `src/integrations/supabase/client.server.ts`, imported from server modules.                                                                                               |

## 2. Personal data

| Finding                                                                                    | Location                                                                              | Action                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Personal Gmail addresses (3 distinct, 13 occurrences) used for admin bootstrap or rollback | `docs/admin/README.md`, `docs/admin/install.sql`, `tests/admin-database-rollback.sql` | Replace them with placeholders (`admin@example.com`) and load real admins from configuration. They are also in history. |
| Seeded or sample listings                                                                  | `supabase/migrations/20261028190000_label_sample_listings.sql`                        | Confirm no real seller names or phone numbers are seeded.                                                               |
| Land-price CSVs                                                                            | Not tracked (they were imported through the admin UI)                                 | OK                                                                                                                      |

## 3. Licence and governance

| Item                                                                                                                         | State                                                                                                                                                  | Action                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `LICENSE`                                                                                                                    | **Missing**                                                                                                                                            | Choose one (e.g. Apache-2.0 for a patent grant, MIT, or AGPL-3.0 to keep hosted forks open). This is an owner decision.                          |
| `package.json`                                                                                                               | `"private": true`, `"name": "tanstack_start_ts"`                                                                                                       | Rename it to `halisia-ai`, and add `license` and `repository`.                                                                                   |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`                                                                       | Missing                                                                                                                                                | Add them. `SECURITY.md` should give a private disclosure address.                                                                                |
| `README.md`                                                                                                                  | A product-vision prompt, not a README                                                                                                                  | Rewrite it: what HALISIA is, the stack, local setup with publishable-key env vars, and how to run the gates.                                     |
| `READ-ME-FIRST.md`                                                                                                           | Outdated upload instructions telling contributors to commit to `main`                                                                                  | Delete it.                                                                                                                                       |
| Stray tracked folders `HALISIA TOKENS STUDIO/`, `UI UX ENHANCEMENT PATCH/`, root PNGs (`preview-tile-glow.png`, `waves.png`) | Tracked                                                                                                                                                | Move them to `docs/assets` or remove them.                                                                                                       |
| Third-party data attribution                                                                                                 | KNBS, IEBC, OpenStreetMap (ODbL), ISRIC SoilGrids (CC-BY 4.0), Open-Topo-Data / ASTER, Copernicus GLO-90, Open-Meteo (CC-BY 4.0), Google Maps Platform | Add `NOTICE` / `DATA-SOURCES.md`. Google Maps content may not be cached or redistributed.                                                        |
| Brand assets (`src/assets/brand/*`, county logos)                                                                            | Tracked                                                                                                                                                | County logos belong to the county governments. Keep the brand under a separate trademark notice, and exclude it from the code licence if needed. |

## 4. Operational exposure if public

| Item                                                                                                                      | Risk                                                              | Action                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Public server functions (`getWave4Intel`, `getWave4Overlays`, `getGeotechIntel`, `getElevationSamples`, cost-intel reads) | Abuse of free upstream providers; `refresh: true` bypasses caches | Add lat/lng range checks and per-IP rate limits, and ignore `refresh` for anonymous callers.                         |
| `synthesizeArticleAudio` (S1)                                                                                             | Paid TTS for any signed-in user                                   | Restrict it to admins, or add rate limits and caching.                                                               |
| `tests/security/financing/*`                                                                                              | The scripts target production                                     | Point them at a disposable project, and document that in their README.                                               |
| Supabase project id in `.env`                                                                                             | Public by design; RLS is the control                              | Keep running `tests/sql/security-regression.sql` and `tests/sql/project-access.sql` in CI against a branch database. |

## 5. Recommended sequence

1. Fix GitHub billing so CI runs. Nothing should be published without green gates.
2. Restrict the Google browser key.
3. Remove PII from the three admin files.
4. Owner chooses the licence.
5. Add `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, a real `README.md` and `DATA-SOURCES.md`.
6. Delete `READ-ME-FIRST.md` and the stray folders.
7. Create a **new** public repository from a clean snapshot of the release head. That removes the history containing PII without force-pushing the Lovable-connected repository.
8. Keep this repository private as the Lovable-synced source of truth.

## 6. Not verified

- Whether the Google key is already restricted (Cloud Console).
- Branch protection on the private repository.
- Licence compatibility of every npm dependency (needs `bun install`, which is blocked here).
