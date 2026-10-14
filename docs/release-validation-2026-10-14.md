# HALISIA release validation — 14 October 2026

Application candidate: build `2026-10-14.2`, based on main `5c4a698d2455744c4c7b56f413a1bb6f0286ea0d`, repair application commit `d1fd91df84124f7437634dab395fc85703038382`.

## Implemented

- Speech cancellation invalidates stale timers and utterance callbacks; pause/resume and passage changes have regression coverage.
- Output catalogue counts are explicitly not findings available for a particular site.
- Missing elevation-grid status withholds terrain-derived interpretations in geotech panels, standalone risk cards, passport evidence and PDF export. Independent soil data remains visible.
- A pending commercial outreach status no longer implies an active contract or a known referral-fee payer.
- Formatting drift corrected; non-component helper functions moved unchanged into separate modules for Fast Refresh compatibility. Speech cleanup uses a stable invalidation callback.
- Dossier tests now enforce the intentionally removed scoring layer, provider facts and persona ordering without restoring unsupported numerical scores.
- Route-shell checks cover public routes, the actual unauthenticated `/auth?redirect=%2Fdashboard` redirect and mobile horizontal overflow.
- Generated browser artifacts are excluded from formatting checks, not application source or tests.

## Passing local checks

- All tracked application files assembled from exact GitHub blobs and verified against their blob hashes before edits; no secret values copied into reports.
- Clean npm lockfile install and Bun 1.4.3 frozen-lockfile install succeeded in an isolated dependency directory; installation scripts were disabled. The existing repository lifecycle prepare command is not required to run application validation.
- TypeScript (`tsgo --noEmit`).
- ESLint with `--max-warnings=0`, with no rule suppression or relaxation introduced.
- Repository Prettier check after excluding generated test artifacts.
- 559 unit tests across 31 files, using Bun-locked dependencies.
- Development and production Vite builds. Existing server-function API deprecation and bundler notices remain warnings, not failed builds.
- Eleven unique Chromium route-shell/auth/mobile checks passed. These check rendering, build identity, page exceptions and logged-out navigation; they do not certify authenticated workflows or outside services.
- Three existing browser checks passed: navigation guide; Home → Explore → simulated pin → report CTA; failed map-tile retry and zoom controls.

## Unresolved release gates

- Existing Wave 4 and Globe/Heatmap/Timeline browser tests failed in this local environment: the Wave 4 panel and globe canvas did not become available. Queries rely on external geocoding/provider scripts. Google Maps is not configured for this local server; Supabase service-role-dependent paths report a missing server secret. These failures have not been called resolved or converted into passing tests through mocked evidence.
- A full browser run, authenticated administration, real deed extraction, AR hardware and paid/protected provider integrations are not certified by these checks.
- The latest observed main GitHub run `38581860248` failed with zero executed quality steps and skipped Playwright. No hosted CI rerun, paid usage, billing changes or card addition was attempted.
- Lovable was switched reversibly to the repair branch to obtain a hosted preview without merging main. Its exact commit was checked through the connector. The static preview initially reported that it had not yet been built. The free Update preview control then produced a hosted preview serving build `2026-10-14.2`, while the connector reported application commit `d1fd91df84124f7437634dab395fc85703038382`. Provider-dependent browser gates remain unresolved; this successful preview load is not full functionality certification.

## Release rule

Do not publish or describe these repairs as live until the hosted preview serves build `2026-10-14.2` from the intended repair commit and the remaining material checks pass. Do not fabricate service keys, registry access, spatial accuracy, imagery dates or verification. No paid credits or paid services were enabled during this work.
