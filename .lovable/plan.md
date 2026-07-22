# Scope

Two items in the request are already shipped in earlier turns and will be left as-is:

- Mobile perf throttled tests (`tests/e2e/mobile-perf-throttled.spec.ts`)
- Persisted soil layers + map tool (`use-persisted-state.ts`, wired into geotech panel and Leaflet toolbar)

This plan focuses on the three new deliverables, all built on top of existing surfaces without redesigning them.

## 1. AI Executive Summary — Simple / Professional / Technical

File: `src/components/halisia/hero-summary.tsx` (extend) + small addition in `src/lib/ai-narrative.functions.ts` if fields missing.

- Add a segmented control (Simple · Professional · Technical) using existing glass-pill styling, persisted via `usePersistedState("halisia:aiView", "professional")`.
- New `ExecutiveSummary` block below the hero rings with sections:
  - **Overview** — 2-3 sentence AI read
  - **Strengths** — bullet list from `narrative.strengths`
  - **Weaknesses** — bullets from `narrative.weaknesses`
  - **Recommended Actions** — bullets from `narrative.recommendations`
  - **Warnings** — bullets from geotech risks + narrative.risks
  - **Confidence** — % badge with tooltip explaining data completeness
  - **Sources Used** — chips: OSM, Open-Meteo, SoilGrids, KNBS, IEBC, Google (only those actually queried)
- View-mode filtering:
  - Simple: Overview + top 3 strengths/weaknesses, plain-language phrasing, no numbers
  - Professional (default): full sections with key metrics inline
  - Technical: full sections + raw scores, formulas, unit annotations, expandable "How this was calculated" per section

## 2. Sliding Sidebar Shell

New: `src/components/halisia/side-panel.tsx` — a right-side sheet (uses shadcn `Sheet` if available, else custom slide-over) that mounts children without unmounting the map.

- Props: `open`, `onOpenChange`, `title`, `width` (`sm | md | lg`), `children`
- Focus trap, ESC to close, backdrop click closes, `role="dialog"` `aria-modal="true"`
- Route (`/explore`) grows a right-edge rail of icon buttons: Search, Property Intel, Construction, Environment, Amenities, Reports. Clicking opens the panel with the corresponding section extracted from `IntelligenceDashboard` tabs — the map stays visible on the left.
- On mobile (<768px) the panel becomes a bottom sheet ~85vh.

## 3. Intelligent Floating Search

Extend: `src/components/halisia/search-bar.tsx` → add `SearchAutocomplete` wrapper, and mount a `FloatingSearch` at app root that stays pinned bottom-center on mobile, top-center on desktop, always accessible.

- Recent searches: `usePersistedState("halisia:recentSearches", [])` — last 8, click to re-run
- Saved searches: `usePersistedState("halisia:savedSearches", [])` — star icon on any recent item
- Suggestions:
  - 47 counties from `kenya-counties.json`
  - Common areas (Kilimani, Karen, Westlands, Runda, etc. — small static list)
  - Coordinate parser hint when input matches lat,lng
  - Natural-language pass-through: if query contains keywords (`near`, `best`, `cheap`, `safe`, `flood`, etc.) it flows through to existing search handler unchanged — the natural-language routing already happens server-side in `location-intel`
- Dropdown groups: Suggestions · Recent · Saved · Natural-language hint
- Keyboard nav: ↑/↓ to move, Enter to select, Esc to close; ARIA combobox pattern

## Technical Details

- All new components colocated under `src/components/halisia/`
- No route restructuring; `FloatingSearch` mounts in `__root.tsx` conditionally (hidden on `/report` viewer)
- No new dependencies; reuse `lucide-react`, existing `Sheet` from shadcn (`src/components/ui/sheet.tsx` — verify exists, else build lightweight custom)
- Persist keys namespaced under `halisia:*`
- Typecheck must pass; add a smoke Playwright test opening the side panel and asserting map remains in DOM

## Out of Scope

- Redesigning existing dashboard tabs (side panel reuses their content)
- Server-side NL query parsing (client hint only; server already handles free text)
- New data sources
