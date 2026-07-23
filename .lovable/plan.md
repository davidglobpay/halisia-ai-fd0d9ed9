# Phase 2 — AI Real Estate Operating System

This is a very large scope. To keep the existing platform stable and shippable, I'll roll it out in vertical slices. Each slice is independently useful, preserves current features, and reuses the existing Land Intelligence Engine, design system (Kenyan palette, glass UI, watermark), auth, and Google Maps / GIS layers.

I'll implement slices in order and check in with you between them. Nothing gets removed from Sections 1–5.

## Slice 1 — Marketplace foundation (DB + core routes)
- New Supabase tables (with GRANTs + RLS scoped to `auth.uid()`):
  - `properties` (kind, category, title, description, price, currency, size, coords, county, status, owner_id, media[], amenities[], ai_score cache, created/updated)
  - `property_media` (property_id, url, type, position)
  - `saved_searches` (user_id, query JSON, alert on/off)
  - `leads` (property_id, buyer_id, seller_id, stage, message, created)
  - `viewings` (property_id, buyer_id, scheduled_at, status)
- Reuse existing `saved_items` for favourites.
- New routes (all under existing navbar, no redesign):
  - `/marketplace` — grid + filters (type, price, size, county, AI score, rental yield, flood risk)
  - `/marketplace/$id` — listing detail with inherited Intelligence Engine panel
  - `/sell/new` — seller upload wizard
  - `/_authenticated/dashboard` — role-aware dashboard shell

## Slice 2 — AI Listing Assistant + Concept Studio
- Server fn `analyze-listing.functions.ts` — takes coords + inputs, runs `runIntelligenceEngine` and Gemini to produce title, description, marketing highlights, buyer profile, price band (labelled *estimate*), suggested developments.
- `/marketplace/$id` gets an "AI Concept Studio" tab for vacant land: generates conceptual site layout suggestions (text + simple SVG diagram), labelled *conceptual only*.

## Slice 3 — Rental marketplace + role dashboards
- Reuse `properties` with `kind='rental'` and unit sub-rows (`rental_units`).
- Landlord dashboard: units, occupancy, leads.
- Buyer/Investor dashboard: saved, compare, alerts, watchlist, downloaded reports.
- Seller dashboard: listings, views, lead count, AI listing score, suggested improvements.
- Roles table via `user_roles` + `has_role()` (per user-roles guidance — separate table, enum, security-definer function).

## Slice 4 — Professionals + Leads + Finance
- `professionals` table (profile, specialty, coverage, verified, ratings).
- `/professionals` directory + `/professionals/$id`.
- Lead management pipeline UI on seller/professional dashboard.
- Finance Centre `/finance`: mortgage / construction-loan / affordability / ROI / rental-yield / cost-estimator calculators (pure client math + AI narrative tie-in). Bank product cards are static content until a bank partner is connected.

## Slice 5 — Search upgrades + AI matching + Payments
- Natural-language search (Lovable AI) → structured filters on `/marketplace`.
- Draw-on-map search using existing Leaflet layer.
- Saved searches → email/in-app alerts (`notifications` table, existing bell).
- AI matching: server fn recommending properties for a user profile.
- Payments: run `recommend_payment_provider` first, then enable seamless Stripe or Paddle for listing fees / featured upgrades / pro memberships.

## Slice 6 — Admin + polish
- `/admin` (gated to `admin` role) for users, listings, payments, moderation, audit logs.
- Playwright E2E covering: create listing → AI enrich → save → contact seller → lead appears in dashboard; rental filter; professional booking; finance calculator.

## Technical notes (for reference)
- All new server logic via `createServerFn` in `src/lib/*.functions.ts`; no Supabase edge functions.
- Every new module reads `runIntelligenceEngine(intel, narrative, persona)` for scores — no duplicate scoring logic.
- AI-generated fields carry confidence % and a "conceptual/estimate" disclaimer.
- Every new table: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY` in one migration, plus `updated_at` trigger.
- Media stored in a new `property-media` public storage bucket.
- Preserves existing routes, palette, watermark, hero, county profiles, intelligence dashboard, PDF exports, saved items, auth.

## What I'll ship first (once you approve)
Slice 1 end-to-end: DB migration, `/marketplace`, `/marketplace/$id` reusing `LandIntelligenceScore`, `/sell/new` wizard writing to `properties`, and wiring the new routes into the existing navbar. Then I'll pause for your feedback before Slice 2.

Reply "go" (or tell me which slice to prioritise / defer) and I'll start with Slice 1.
