# One upload. No edits.

Everything is now a complete file. The nine hand-edits are gone — I read each of
those files out of your live project, applied the changes, and verified the
result, so they ship as whole files like the rest.

**28 files, one commit, nothing to type.**

---

## The upload

On a desktop browser:

1. `github.com/davidglobpay/halisia-ai-fd0d9ed9`
2. **Add file → Upload files**
3. Drag in **both** the `src` folder and the `tests` folder from this bundle.
   GitHub keeps the paths, so every file lands where it belongs and replaces
   what is there.
4. Commit message:

```
Remove every figure the app could not source

County scores, the public-opinion index, the dossier's unmeasured
modules and the stored marketplace score were all generated rather
than measured. What is left traces to KNBS 2019, the IEBC register,
OpenStreetMap, the Google Maps Elevation API, the Google Air Quality
API, Google Places, and the seller's own fields.

Also restores the ivory globe background and adds the rotating green
tile glow.

Three test files fail CI if any of it returns.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SgQhPWK3C6yqNYGGYCA87Y
```

5. Commit to `main`. Wait for the CI tick, then deploy from Lovable — publishing
   costs no credits.

### One optional tidy, afterwards

`src/components/halisia/sky-scroll.tsx` is unused once this lands. An upload
can't delete a file, so remove it in GitHub when convenient: open it → bin icon
→ commit. Nothing imports it, so leaving it costs nothing but clutter.

---

## What's in the 28

**The truth work — 20 files**

`src/lib/` — county-metrics.ts, county-profile.ts, county-politics.ts,
pdf-county-profile.ts, pdf-county-compare.ts, intelligence-engine.ts,
pdf-intelligence.ts, marketplace.ts, seller-tools.ts

`src/components/halisia/` — county-politics-panel.tsx, kenya-county-map.tsx,
kenya-county-leaflet.internal.tsx, land-intelligence-score.tsx, hero-summary.tsx

`src/routes/` — county.$code.tsx, compare.tsx, compare-locations.tsx,
marketplace.index.tsx

`tests/unit/` — truth-language.test.ts (replaces the existing one),
dossier-sourcing.test.ts (new)

**The eight that were hand-edits — now whole files**

- `src/styles.css` — your 1,072 lines untouched, with the 213-line glow block
  appended at the end
- `src/routes/index.tsx` — SkyScroll removed, the three hero layers back to
  solid ivory, and the "How it works" step no longer credits two datasets the
  app has never read
- `src/components/halisia/landing-sections.tsx` — the compare-page blurb no
  longer promises livability, growth or water reliability
- `src/components/halisia/intelligence-dashboard.tsx` — the Livability chip and
  the "AI confidence" figure replaced with a plain ready/loading state
- `src/components/halisia/nav-guide.tsx` — "AI Land Intelligence Score" →
  "Location readings", with honest body copy
- `src/routes/marketplace.tsx` — both meta descriptions; the og:description
  still said "AI-scored real estate marketplace", which it no longer is
- `src/lib/listing-wizard.ts` — two field explanations that promised scoring
- `src/lib/listing-coach.functions.ts` — one more of the same

Nothing in `src/components/halisia/spatial/`, the model-lab renderer,
`public/_massing/`, the konza fixtures, or any migration is touched. The
Supabase `ai_score` column stays exactly where it is, with nothing reading it.

---

## The glow

It's already in `styles.css`. One dial, near the top of the appended block:

```css
--tile-glow-strength: 0.65; /* 0.5 = subtle, 0.85 = vivid */
--tile-glow-spread: 18px; /* thickness of the ring */
--tile-glow-speed: 14s; /* one full turn */
```

`preview-tile-glow.png` in this folder is the real Chromium render, not a
mockup. The halo is a masked ring that paints only outside each tile's edge, so
body text keeps the contrast it was designed with and the effect survives the
hover lift. A few panels carry `overflow-hidden` (the hero summary is one) and
will clip it to a green rim rather than letting it spill.

---

## What I verified, and how

I could not run `npm test` — this sandbox's package registry is blocked — so I
will not tell you the suite passed. What I did run:

- **Every assertion in both test files, reimplemented in plain Node and run
  against these 28 files as a complete tree.** All pass.
- The three files the tests read but I am not shipping — `evidence.ts`,
  and the live versions of the rest — checked directly against the live project
  today. `evidence.ts` has `Not machine-verifiable` and the correct
  `halisia-ai` domain, so the evidence-citation block passes too.
- `tsc --strict --noUnusedLocals` over every changed file, against stub module
  declarations standing in for the blocked dependencies.
- The real `marketplace.ts`, `intelligence-engine.ts` and `county-metrics.ts`
  transpiled and executed over synthetic fixtures: completeness and the listing
  tier are identical with and without `ai_score`; a listing carrying a stored 99
  gets no investment tag; the dossier withholds a composite below two measured
  modules and renormalises over the measured weights.
- Every hand-edited file checked by line count against its live original, so
  nothing was silently dropped in transcription. `styles.css` 1072 → 1286
  (append only). `index.tsx` 527 → 525 (two deleted lines).
  `intelligence-dashboard.tsx` 885 → 880 (a nine-line block became four).
  The other five are unchanged in length.
- The glow was rendered in real Chromium rather than reasoned about.

**CI should be green on the first tick.** I checked every required string the
tests assert against your live `index.tsx`, `landing-sections.tsx` and
`evidence.ts` before packing, and the versions in this bundle keep all of them.

---

## Still open, and not about truth

- **Partner listings have no source URL.** All 33 rows are `discovery_only`, so
  the referral handoff has nothing to link to. This is the revenue-blocking one.
- Security regression checks 31–35 write to production, so I have not run them.
- The AR path needs an ARCore physical device; it cannot be tested from here.
- `VerificationStatus` in `marketplace.ts` still has the value names
  `"verified" | "reviewed" | "unverified"` internally, because other call sites
  and a test key off those strings. Every user-facing label now says what it
  actually measures ("Details complete", "Most details given", "Sparse
  details"), and the docblock says plainly that nothing there verifies a claim —
  but the internal names are a trap for whoever reads that file next, and are
  worth renaming properly some day.
