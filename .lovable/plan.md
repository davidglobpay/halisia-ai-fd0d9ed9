# HALISIA — Phased Delivery Plan

You picked all four tracks. Honestly: this is 6–10 focused turns of work, not one. Trying it in a single pass will half-break the current app (LIOS, county profiles, PDFs, maps, geotech — all working today). Here's the order I'll ship in, one phase per turn, so each phase leaves the app green.

## Phase 1 — Foundation (this turn)

1. **Enable Lovable Cloud** (DB + auth + storage). Prereq for everything in Phase 4+.
2. **Rebrand — Kenyan flag palette + architectural typography.**
   - Tokens in `src/styles.css`: `--background` deep black `oklch(0.16 0.02 250)`, `--foreground` white, `--primary` emerald `oklch(0.62 0.18 155)`, `--destructive` crimson `oklch(0.58 0.22 25)`, `--accent` metallic gold `oklch(0.78 0.14 85)`. Lighter/darker shades for hover/borders/gradients.
   - Fonts via `<link>` in `__root.tsx`: **Space Grotesk** (display) + **Inter** (body) + **JetBrains Mono** (data/coords). Register in `@theme`.
   - Semantic usage rules: green = positive/verified, red = risk/warning, gold = premium/AI/awards, black = surfaces, white = text.
   - Subtle logo watermark (~4% opacity, blurred, gold glow) on landing + county profile hero sections.
   - Futuristic textures: topographic contour SVG overlay + faint grid, both as CSS backgrounds behind hero sections.
3. **Search dialog redesign** (`floating-search.tsx`)
   - Minimal, single-column layout, gold-accent focus ring.
   - Ready-made suggestion chips: "Kilimani, Nairobi", "Karen residential plot", "Naivasha lakefront", "Kajiado farmland", "Diani beachfront", "Mombasa CBD".
   - Recent searches, My Location pill, ⌘K hint — cleaner grouping.
4. **Pop-up navigation guide** — first-visit tour (localStorage-gated) pointing to: search (⌘K), county tiles, LIOS panel, PDF download, compare, geotech tab. Skippable, "Don't show again".

## Phase 2 — Auth + Saved Properties (next turn)

- Managed `_authenticated/` layout, `/auth` page with Google + email/password.
- `profiles` + `saved_properties` + `favorites` tables with RLS + GRANTs.
- "Save" button on county profiles and search results; "My Saved" dashboard route.

## Phase 3 — Calculators (one turn)

- `/tools/mortgage` — CBK-rate aware amortisation, KES formatting.
- `/tools/construction` — BOQ by class (economy/standard/premium) × m² × county multiplier.
- `/tools/roi` — rental yield + capital appreciation + break-even.
- Shared inputs, chart.js visualisations, PDF export via existing `pdf-intelligence` scaffold.

## Phase 4 — Marketplace + Listings (2 turns)

- `listings` table (owner, geo, price, media, verification status).
- Create/edit/delete flows, image upload to Cloud storage, search/filter, favorites, contact seller (in-app message).
- Verification badge driven by document upload + admin review flag.

## Phase 5 — Professional Marketplace + Community Contributions (2 turns)

- `professionals` (architects, valuers, surveyors) with portfolio + ratings.
- AI matching against active LIOS location.
- Contributor submissions (photo/GPS) → AI moderation server fn → points/rewards ledger.

## Phase 6 — Payments + Admin (1 turn, after `recommend_payment_provider`)

- Stripe seamless for report unlocks / professional bookings / listing boosts.
- `/admin` gated by `user_roles` (separate table, `has_role` SECURITY DEFINER — per project rules).

## Phase 7 — Audit sweep (1 turn)

- Playwright: run full suite, fix regressions.
- A11y: axe pass, contrast against new palette, keyboard nav on all new dialogs.
- Perf budget: lazy-load Cesium/Leaflet/Mapillary chunks, image `loading="lazy"`, route-level code split verification.
- Security: RLS on every new table, input validation (zod) on every server fn, rate-limit public webhook routes.

## What I need from you

**Just say "go" to start Phase 1 now.** If you'd rather I sequence differently (e.g. marketplace before rebrand), tell me the order.

## Technical notes

- Payments provider will be picked by `recommend_payment_provider` in Phase 6, not guessed now.
- Cesium/Mapillary already lazy-loaded — leave alone.
- Existing LIOS + county profile + PDF pipeline is not being rewritten, only re-themed.
- Watermark logo uses existing asset; no new logo work.
- No background videos (per your prior instruction).
