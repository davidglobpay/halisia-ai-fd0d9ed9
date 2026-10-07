# Output accessibility and visual references

Based on main 4730a9ceb2b78fd7d4e0003531b98bc5272cbfc7. The audit found existing readers in Passport evidence rows and summary components, with gaps in shared tiles, geotechnical readings, weather readings, place cards, county facts, public-data tiles, dashboard metrics, planning statistics and marketplace summaries. This release adds readers in those paths. Source integration coverage does not mean every authenticated screen or Android device has been browser/audio tested.

Readers use browser speech synthesis with no server voice charge, one active reader at a time, cancellation on unmount, stale callback guards, short sequential passages, and explicit unavailable states. Existing ReadAloud entry points now use that shared controller. The current visible output is read on click, including displayed sources and limitations. Hidden content and form controls are excluded. Kenyan English is preferred when installed, with English fallback.

Icons identify soil, foundations, crops, minerals, schools, health, water, roads, energy, terrain and environment. Eleven curated Commons references cover soil horizons, strip foundations, shallow foundation types, bored piles, quartz, limestone, maize, tea, potatoes, beans and coffee. Each catalogue record carries the source file, creator, licence and original location. Images are labelled reference illustrations, not site evidence. These pictures do not establish local mineral occurrence, soil properties, crop suitability or an approved foundation. Missing evidence facts do not receive a reference picture. Other subjects retain semantic icons until appropriate media is curated.

Named schools and amenities retain photographs tied to the actual place-provider record. No generic venue photograph is substituted. Missing or failed photographs show a labelled fallback. Venue imagery is not parcel evidence. Reference imagery is lazy loaded from Commons; unavailable images retain their caption and source.

Research: Commons file description and licence pages were checked on 7 October 2026 UTC. The source URLs and licence URLs are in src/lib/output-visuals.ts. No paid image provider was introduced.

Validation: 23 focused output tests and the full 215-test unit suite pass; TypeScript and production build pass. ESLint reports no errors in changed components (two non-blocking shared-helper/ref warnings). Publication and real-device audio verification must be reported separately from these local checks.
