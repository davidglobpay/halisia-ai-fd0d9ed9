# HALISIA release 2026-10-19.2

Base: `8bbad9b4580b76e38e2ce7b131f3a1f0f47c4505` on `codex/reconciled-release-20261015`.

Pulse now uses word-boundary keyword and place matching rather than substring matching. An explicit deterministic relevance gate runs before optional AI enrichment. Mining, industrial parks, refineries and local environmental terms are included. A pure classifier module has regression coverage. Rejected items are counted in provider summaries, persisted ingestion logs and the admin dashboard.

Public view signals use UUID validation, one atomic database increment and a bounded process-local 60-second article cooldown. They are labelled sampled signals rather than reads. The cooldown is not a distributed or caller-aware rate limiter. Views no longer contribute to trending scores. Existing active scores were recalculated with the same freshness/spread/save/share/importance formula, omitting views. Authenticated save/share manipulation was not audited by this release.

Archived article detail requests now return no article. Private audit records make the cleanup reversible; nothing was deleted. On 19 October the deterministic dry run covered 12,154 active articles: 3,924 passed, 736 failed the geography gate but had a relevant topic and were retained for review, and 7,494 had no qualifying topic and were archived. Final active count: 4,660. Samples were reviewed before applying. Keyword classification remains heuristic: retained items can still be irrelevant and relevant stories may lack matching vocabulary. Foreign stories with genuine core topic words can still pass; this is not verified Kenyan geolocation.

Map evidence previews, Passport PDF maps, static map fallbacks and primary fallback terrain now use Esri imagery/street/topographic reference tiles. The layer chooser retains an explicit OpenStreetMap alternative and removes duplicated, mislabeled Carto options. Attributions reflect the selected provider. PDF map capture loads only tiles intersecting its viewport and reuses the existing image cache. Partial or near-uniform captures are withheld before markers are drawn. Uniform genuine scenery may also be withheld; non-uniform provider notices cannot be reliably detected by this heuristic. Map tiles remain third-party reference context, not proof of findings or parcel boundaries. Esri topographic tiles are a reference basemap, not a measured site elevation model.

## Database rollout and verification

Applied additive SQL `20261019120000_pulse_relevance_and_atomic_views.sql` before application deployment. It adds `rejected_count`, a security-invoker atomic RPC with an empty search path and service-role-only execute, and an RLS-enabled private archive audit table. Production privilege checks confirmed anon/authenticated cannot execute the RPC; anon cannot read the audit. A production increment assertion ran in a rolled-back transaction without retaining a view change.

`node scripts/pulse-cleanup.cjs preview` prints the review query. `apply` archives and records article ids and content hashes under run id `pulse-relevance-20261019-v1`. Apply is idempotent for that run. `restore` prints restoration SQL, limited to unchanged article content. Execute SQL through an authorized database connection. Review later retention/archive operations before restoring, since the audit cannot distinguish another operation that also leaves an article archived.

## Validation

- 726 unit assertions across 52 files passed.
- 33 isolated PostgreSQL assertions passed for increments, integer bounds, archived exclusion, permissions, classifier/SQL parity and archive/restore.
- Type check, repository ESLint, Prettier and production build passed.
- Three Esri services returned HTTP 200 image tiles; a topographic tile was visually inspected.
- No paid Lovable prompts or GitHub Actions were used.

Deployment is verified separately against the public HTML build marker; project metadata alone is insufficient.

## Remaining limits

Authenticated Eldama Ravine Passport generation and voice/highlight behavior still require a signed-in end-to-end check. This release does not certify those flows. The prior `supabase_admin` default-privilege change still requires the database owner; no bypass was attempted. Payments, subscription activation and Scout dispatch remain disabled. This update does not provide measured bedrock/groundwater evidence or title-to-location verification.
