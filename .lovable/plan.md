# Calm controls, evidence-complete Passport PDF, and parcel-linked 3D Design Studio

## Scope
Deliver the three requested improvements as additive work while preserving current maps, Passport evidence rules, Spatial/XR, Model Lab renderer internals, parcel geometry, Konza fixtures, and protected massing files.

## 1. Calm the persistent interface
- Remove the globally mounted floating search bar while retaining search on the landing page and existing destination pages.
- Make the fixed “Launch HALISIA” action smaller, mobile-safe, and visually secondary to the page’s primary action.
- Remove perpetual decorative glow/pulse/spin from the landing logo and AI assistant. Keep functional loading indicators and brief interaction feedback.
- Preserve reduced-motion support and ensure fixed controls do not overlap content or mobile navigation.

## 2. Include the generated AI evidence summary in the Passport PDF
- Lift the already-generated evidence summary into Passport page state; downloading never starts a new AI request.
- Parse its `[evidence-id]` citations against the current Passport evidence rows and include only matching supporting sources.
- Add an AI interpretation section to the PDF containing:
  - generated summary and generation time;
  - evidence class: **AI interpretation — not source data**;
  - a derived confidence label based on cited evidence coverage and the underlying rows, never an invented score;
  - supporting source names, retrieval times, and cited finding IDs;
  - explicit limitations, unavailable evidence, and non-verification language.
- When no summary was generated, state that plainly in the PDF rather than silently omitting it.
- Keep legal/title/boundary/ownership/survey claims unavailable unless evidence actually supports them.

## 3. Add a parcel-linked 3D Design Studio
- Create a dedicated, client-safe Design Studio page and link it from the Land Passport and existing product navigation.
- Pass only Passport context the user actually has: location label, coordinates when valid, reference text, and location precision. Coordinates position the context only; they do not create or confirm a parcel boundary.
- Reuse the existing deterministic Design Studio calculations and five protected concept models read-only. Do not modify/copy the protected files or alter production Spatial/Model Lab internals.
- Present five complete Kenyan-context concept scenes:
  1. residential villa;
  2. affordable/shared-living apartment community;
  3. mixed-use neighbourhood centre;
  4. commercial mall/plaza;
  5. special-purpose logistics/mini-city employment campus.
- Compose parking, pedestrian paths, planting, trees, drainage/open-space cues, and topology presets around each building in the new studio scene. These are illustrative concept layers, not survey, planning, geotechnical, hydrological, or approval evidence.
- Support direct model selection and placement on user-entered **simulation dimensions**. Never infer dimensions or boundaries from title area or map coordinates.
- Provide topology presets (level, gentle slope, terraced slope) as user-selected concept conditions. Do not label them measured terrain unless a current evidence source supplies terrain data.
- Add practical controls for model/use selection, topology, rotation, scale, fit/reset, day/neutral/night, parking and landscape visibility, plus clear loading/error/unsupported states.
- “Generated” will mean deterministic concept massing constrained by user-entered assumptions. The app will not claim to generate construction-ready or photoreal architectural files.
- Label the five shipped scenes as polished **concept visualizations**. “Hyperrealistic” will not be claimed for the existing small massing files; the presentation will instead use grounded Kenyan materials, vegetation, lighting, and site composition within mobile performance limits.

## 4. Validation
- Add unit tests for AI citation resolution/confidence derivation and Design Studio assumption/provenance rules.
- Add focused browser tests for Passport → Design Studio context transfer, all five models, model placement/reset, graceful WebGL fallback, AI-summary PDF download, and the no-summary PDF state.
- Visually inspect phone and desktop layouts, all five 3D scenes, downloaded PDF pages, overlap/overflow, and loading/error states.
- Run typecheck, unit tests, scoped lint, production build, and focused browser checks. Physical AR/VR remains device-only and is not part of this Design Studio validation.

## Technical details
- Keep the existing Three.js engine and SSR-safe lazy-loading pattern; add no 3D dependency.
- Use a local semantic scene palette, shared disposal/framing utilities, bounded pixel ratio, shadows, and explicit resource cleanup.
- Keep all simulation data local to the page for this scope; no database migration or production writes.
- Preserve existing AI Gateway model/protocol and safe error messages; PDF export consumes only a successful summary already generated by the user.
