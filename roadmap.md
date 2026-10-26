# Current work

## Land Passport PDF completion (2026-10-26)

- [ ] Add top title page + table of contents describing entire report outputs
- [ ] Finish partial items: amenity dedupe, category icons, blank-page/page-flow checks
- [ ] Omit unsupported content (Street View, invented figures) rather than inventing
- [ ] Rerun ESLint with real exit code, format check, vitest; generate + inspect sample PDF (-1.560328, 36.938554)
- [ ] Keep BUILD_ID unchanged; no publish, no DB/secret/cron changes

## Cost Intelligence Phase 1 (structure only, no invented data)

- [ ] Supabase tables: land_price_obs, material_price, boq_template, labour_rate (RLS: public read, admin write) — tables start EMPTY
- [ ] Admin CSV import per table with row validation
- [ ] Land price per location (Passport + /explore): 5 plot sizes, ward→sub-county median, 12-month window, n≥5 gate, "Market estimate, not a valuation."
- [ ] /build-cost calculator: structure × typology × finish, BoQ line items, 90%-priced gate, cheapest→highest comparison
- [ ] /budget planner: deterministic ward ranking, leftover margin, data counts; AI summary of computed table only
- [ ] Unit tests: unit conversion, n≥5 gate, 90%-priced gate
- [ ] Checks: typecheck (auto), lint, vitest, production build — report honestly; do not publish

## Prior backlog (unchanged)

- [ ] Validate signed-in climate/terrain/soil/amenities export; blocked until user signs in to preview
