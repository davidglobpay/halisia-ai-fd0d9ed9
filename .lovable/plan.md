
## Scope

Three connected additions to the existing marketplace, all scoped to authenticated users and RLS-protected. No redesign, no changes to branding or existing intelligence engine.

## 1. Professional matching — bid requests

**New tables**
- `bid_requests` — id, property_id, owner_id, scope (text), category (enum: construction, architecture, surveying, legal, other), budget_min, budget_max, currency, timeline (text), status (enum: open, awarded, closed), created_at, updated_at.
- `bid_proposals` — id, bid_request_id, provider_id (auth.users), company_name, contact_email, contact_phone, amount, currency, timeline_days, message, status (enum: submitted, shortlisted, accepted, rejected, withdrawn), created_at, updated_at.

RLS:
- Owner reads/writes their own `bid_requests`; providers read `open` requests.
- Providers manage their own `bid_proposals`; owners read proposals on their requests and can update `status`.

**UI**
- On `marketplace/$id` (owner only): "Request bids from professionals" panel → opens dialog to create a `bid_request`, then lists received proposals with shortlist / accept / reject controls.
- New `/_authenticated/dashboard` section: "My bid requests" table with proposal counts and status.
- New public-ish `/_authenticated/pros` route: providers see open requests and submit a proposal.

## 2. Financing application tracker

**New table**
- `financing_applications` — id, applicant_id, property_id (nullable), borrower_name, borrower_email, borrower_phone, monthly_income, employment_status, requested_amount, currency, purpose (enum: purchase, construction, refinance, bridge, other), tenure_months, property_value, property_address, notes, ai_summary (jsonb), status (enum: draft, submitted, under_review, approved, rejected, funded, withdrawn), lender_name, created_at, updated_at.

RLS: applicant manages their own rows only.

**UI**
- `/_authenticated/financing` — list + create + status kanban-lite (grouped by status), status-change buttons, and a "Generate lender summary" action that calls a new `generateLenderSummary` server fn (Lovable AI, `google/gemini-3.6-flash`) producing a structured JSON brief (loan snapshot, borrower profile, property overview, risk flags, DTI estimate, recommended documents) stored in `ai_summary`. Preview + copy + download as text.
- Optional link from `marketplace/$id` "Explore financing" CTA that pre-fills property fields.

## 3. Insurance & risk brief per listing

**New table**
- `insurance_briefs` — id, property_id (unique), generated_by, ai_output (jsonb: keyRisks[], confidencePct, recommendedCoverage[], questionsForInsurer[], disclaimers[], generatedAt), created_at, updated_at.

RLS: owner of the parent property manages; anyone authenticated can read (matches marketplace visibility).

**UI**
- `marketplace/$id`: new "Insurance & risk brief" card. Owner sees "Generate / regenerate" button; everyone sees the brief with confidence chips, risk list, recommended coverage, and questions to ask insurers. Downloadable as text.

**Server fn**
- `generateInsuranceBrief` (Lovable AI, `google/gemini-3.6-flash`) — inputs: property row + existing geotech/wave4 hints if present in `ai_summary`. Outputs structured JSON above with per-risk confidence.

## Technical notes

- All new server logic uses `createServerFn` + `requireSupabaseAuth` in `src/lib/*.functions.ts` (bids, financing, insurance).
- New client libs: `src/lib/bids.ts`, `src/lib/financing.ts`, `src/lib/insurance.ts` for typed CRUD via the browser client.
- AI calls reuse the existing Lovable AI gateway helper used by `ai-listing.functions.ts` / `ai-narrative.functions.ts`. Handle 402/429 with a visible toast.
- All new tables include GRANTs to `authenticated` + `service_role`, RLS enabled, and an `updated_at` trigger via existing `public.set_updated_at()`.
- Routes: `src/routes/_authenticated/pros.tsx`, `src/routes/_authenticated/financing.tsx`; edits to `src/routes/marketplace.$id.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/components/halisia/navbar.tsx`.
- No changes to Kenyan-flag palette, hero, or existing intelligence modules.

## Verification

- Typecheck + lint pass (`bun run fix && bun run typecheck && bun run lint`).
- Manual smoke: create bid request → submit proposal from a second account → shortlist/accept. Create financing app → generate lender summary → change status. Generate insurance brief on a listing → confirm it renders for a visitor.

## Out of scope (this pass)

- Provider verification workflow, payments/escrow, messaging threads, notifications, actual lender API integrations, and insurer quotes. These can follow as a separate slice once the data models above are in production.
