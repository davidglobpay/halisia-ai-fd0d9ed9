## Scope

Six related items across county intelligence UI + tooling.

### 1. County hero emblem parity
Update `src/routes/county.$code.tsx` hero to match tile reference:
- Circular white background, ring, shadow
- Larger centered emblem (~112px)
- Uppercase bold county name below
- Numbered badge (county code) matching tile style

### 2. Persistent compare + comparison summary
- Persist compare selection in `localStorage` (`halisia.compare.v1`) via new hook `src/hooks/use-compare-selection.ts`
- Wire `kenya-county-map.tsx` compare toggles to it (replace ephemeral state)
- New route `src/routes/compare.tsx` rendering side-by-side comparison of selected counties: emblem, confidence, key metrics (population, area, GCP), political leadership, and turnout — sourced from existing `county-profile.ts` + `county-politics.ts`
- Floating "Compare (N)" action on counties grid linking to `/compare`

### 3. Public political opinion panel
Extend `src/components/halisia/county-politics-panel.tsx` with a new "Public Opinion" section:
- Aggregated sentiment tiles (governance, service delivery, security, economy) with numeric scores + qualitative label
- Source citations list (IEBC, KNBS, Afrobarometer, CIDP, TIFA, Infotrak) rendered as linked chips
- Guardrail banner: "Research aggregate — not a poll. Verify with IEBC/primary sources."
- Correlation strip: sentiment score vs last 3 election turnouts as SVG dual bars, with disclaimer footnote

Data source: extend `src/lib/county-politics.ts` with `publicOpinion(code)` returning deterministic pseudo-aggregate keyed off existing turnout/issue arrays so it's reproducible and clearly non-polling.

### 4. Editor/formatter enforcement
- Add `.editorconfig` (already may exist — verify) and `.prettierrc` alignment
- Add `.vscode/settings.json` with `editor.formatOnSave` + `editor.codeActionsOnSave.source.fixAll.eslint`
- Add `.vscode/extensions.json` recommending Prettier + ESLint

### 5. Auto-fix script
Add to `package.json`:
```
"format": "prettier --write .",
"lint:fix": "eslint . --fix",
"fix": "bun run lint:fix && bun run format"
```

### 6. Verify build
Run `bun run build:dev` after edits.

## Technical notes

- Compare hook: SSR-safe (guard `typeof window`), max 4 selections
- `/compare` route: public, reads from localStorage on mount (useEffect), shows empty state if none
- Public opinion values derived, not fabricated poll numbers — labeled "Composite index" everywhere
- No changes to existing tile layout, dashboards, or unrelated features
