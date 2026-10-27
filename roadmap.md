# Current work

## Cost Intelligence regression repair and release (2026-10-27)

- [x] Confirm edit branch, not main; reproduce seven fixture failures
- [x] Preserve explicit inclusion rule; repair eligible fixtures and add exclusion coverage
- [x] Format and zero-warning ESLint exit 0; full Vitest 896/896; preview build OK
- [x] Verify real Kajiado calculator flow; 90% gate withholds totals; no browser errors
- [ ] Separate typecheck result unavailable from permitted automatic evidence
- [x] Request authorized publication at halisia-ai.lovable.app
- [ ] Deployment completion and production-build result not yet exposed

## Land Passport PDF completion (2026-10-26)

- [x] Add top title page + table of contents describing entire report outputs
- [x] Amenity dedupe (Google/Overpass duplicates) and calm category icon discs
- [x] Blank-page scan on generated sample PDF (20 pages, none blank)
- [x] ESLint exit 0, format check, vitest 834/834; sample PDF generated and inspected
- [x] BUILD_ID unchanged; no publish, no DB/secret/cron changes

## Cost Intelligence Phase 1 (structure only, no invented data)

- [x] Tables land_price_obs, material_price, boq_template, labour_rate with RLS (public read, admin write) — verified empty
- [x] Admin CSV import with row validation (admin route)
- [x] Land price panel in Passport + /explore: 5 plot sizes, ward→sub-county median, 12-month window, n≥5 gate, "Market estimate, not a valuation."
- [x] /build-cost calculator: structure × typology × finish, BoQ lines, 90%-priced gate, cheapest-first comparison
- [x] /budget planner: deterministic ward ranking, margin, data counts
- [x] Unit tests: unit conversion, n≥5 gate, 90%-priced gate (11 tests)
- [x] Checks: typecheck+preview build OK (automatic), ESLint exit 0, vitest 834/834; production build unverified (environment-gated)

## Prior backlog (unchanged)

- [ ] Validate signed-in climate/terrain/soil/amenities export; blocked until user signs in to preview
