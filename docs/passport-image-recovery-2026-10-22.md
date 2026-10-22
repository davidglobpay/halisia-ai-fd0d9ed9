# Passport image recovery — 22 October 2026

Base: cda9781255436c50de2151a5f316bee55f040a19. This review branch preserves that complete tree and changes only the listed PDF modules/tests plus this note.

A failed reference map tile now receives one retry of the identical URL. Successful tiles are not refetched. Persistent missing tiles and blank compositions still return no map; no partial, generated or substitute site imagery is accepted. The existing loader evicts failed loads. One retry can add up to the existing 15-second loader timeout for a failed tile. No change to coordinates, scope, zoom, source attribution or provider selection.

Carries forward c0dd539: centered Passport lockup and text fallback on every page; positive proportional forecast bar widths for dense series; existing watermark retained.

Validation: 16 tests across five targeted files passed; targeted lint and TypeScript passed in the available checkout. Removing the retry reproduces two test failures; the old chart width also previously reproduced the dense-series defect. Current remote versions of the two changed production modules were compared before patching. No full build of the entire newest remote tree or authenticated mobile browser export was run this turn. Yesterday's synthetic layout cover was visually reviewed; no real site report or production download is claimed.

Production homepage returned HTTP 200 and build 2026-10-20.1 on this run. This review branch is not publication evidence. Remaining: hosted PDF export validation, close-up framing and scale labels, location-matched licensed photographs, and nearest available panorama selection. Existing Street View URL links do not prove nearest-panorama coverage. Do not infer foundation design or groundwater depths from regional models. Preserve protected spatial/XR/parcel/authentication surfaces.
