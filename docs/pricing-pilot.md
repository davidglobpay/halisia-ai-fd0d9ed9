# HALISIA pricing visibility pilot

Published tariffs are suggested commercial launch prices, not collected fees.
The shared catalogue in src/lib/service-pricing.ts feeds contextual panels and
the public /pricing page. Existing beta functions remain accessible without
entitlements. Disabled activation buttons do not create orders or payments.

| Service | Suggested KES | Unit |
| --- | ---: | --- |
| Land Passport | 490 | location |
| Detailed dossier | 1490 | location |
| Comparison | 790 | up to 3 locations |
| Design concept pack | 990 | pack |
| Featured listing | 500 | 7 days |
| Seller Pro | 1490 | month |
| Professional Pro | 990 | month |
| Business API pilot | 9900 | month, proposed 1000 calls |
| Financing enquiry | 0 | enquiry |

Expanded dossiers, sponsored placements, commercial API quotas and subscription
benefits require delivery work as well as payment integration. Each UI card
states its readiness; none promises that payment alone unlocks missing work.
Confirm tax-inclusive totals and terms before activation. External provider and
government fees are separate.

Scout prices are read from the existing database catalogue, with a labelled
suggested-price fallback during loading/error. The server remains authoritative
for a request quote. Basic defaults total 1150; full checklist 5635, both before
travel/access. Never verify receipts using the display-only service catalogue.

The duplicate src/routes/scout.tsx upload is removed; its provenance and honest
observation wording fixes are merged into src/routes/_authenticated/scout.tsx.
The existing authentication, title-search handoff and booking backend are reused.
