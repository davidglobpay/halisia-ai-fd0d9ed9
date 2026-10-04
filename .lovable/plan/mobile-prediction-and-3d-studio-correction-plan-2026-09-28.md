# Mobile, prediction, and 3D Studio correction plan

## What will change

### 1. Stop mobile pages from cropping horizontally

- Reproduce the overflow on the title-deed results flow at phone widths, including its map and intelligence sections.
- Make the page grid, search row, cards, long references, tabs, and generated text shrink or wrap within the viewport.
- Keep deliberately scrollable rows contained inside their own rails rather than widening the page.

### 2. Replace empty intelligence states with truthful projections

- Use existing location evidence to produce clearly labelled **indicative projections** where a reasonable proxy exists, such as amenity access, market activity signals, utility-access context, community services, environmental context, and development pressure.
- Show the evidence used, projection confidence, limitations, and the next check inside each expandable card.
- Do not estimate ownership, title validity, parcel boundaries, legal status, approved zoning, utility capacity, safety incidents, or future investment returns without supporting data. Those cards will instead present a useful due-diligence risk/check outcome, not a fabricated fact or score.
- Keep provider failure distinct from a real zero result and from an evidence gap.

### 3. Correct the Design Studio view and controls

- Fit the complete scene after every model finishes loading, after generated massing changes, and after viewport resize so buildings, parking, and landscaping remain visible.
- Improve model centring using final world bounds and a camera fit that accounts for the actual phone/desktop aspect ratio.
- Make every visible control reliably operable, add explicit pressed/disabled states, prevent loading overlays from blocking taps, and keep controls usable on phones.
- Verify concept selection, generated massing, use/floor controls, dimensions, topology, rotation, scale, day/neutral/night, parking, landscaping, Fit, Reset, and orbit/zoom interaction.

## Validation

- Add focused regression coverage for mobile overflow, evidence-labelled projections, camera fitting, and Studio controls.
- Run type checking, focused tests, lint for changed files, and the production build.
- Browser-check the title-deed/results flow and Design Studio at 360 px, 390 px, and desktop; inspect screenshots and confirm no horizontal clipping.
- Preserve Spatial/WebXR, Model Lab internals, parcel evidence, protected massing files, and backend data unchanged.

## Technical notes

- Changes stay within title-deed/intelligence presentation, reusable evidence-aware projection logic, Design Studio route/viewer, and focused tests.
- The Design Studio remains an assumption-led visualization. No visual placement will be described as surveyed parcel fit, planning approval, or architectural proof.
