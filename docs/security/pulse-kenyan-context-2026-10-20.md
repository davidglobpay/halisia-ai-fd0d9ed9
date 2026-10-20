# Pulse Kenyan-context relevance repair — 20 October 2026

Base: 524236a21c23e60fc27ec6b7abab97098d99bc8b (build 2026-10-19.2).

Source review confirmed the earlier boundary matcher, pre-AI rejection gate, rejected counters and Esri layers have landed. The gate still accepted foreign land/property/flood/infrastructure headlines because core topics bypassed Kenyan-context checks.

Repair: require Kenyan text context for every accepted topic, retaining gazetteer matches, Kenya/Kenyan(s), and explicit Ardhisasa/KeNHA/KPLC references. Provider country hints alone cannot establish relevance. Topic and geographic relevance remain a heuristic, not verification, registry evidence or exact location proof. Ambiguous personal/place names and mixed international stories remain limitations of the existing gazetteer.

Validation: 36 targeted Vitest tests. The unmodified base failed five new assertions (London property, Pakistan flooding, California rail, Ireland housing and a misleading provider country hint). Patched source passed all 36, including the ten existing genuine Kenyan stories, Ardhisasa national context, excerpt context, plurals and arbitrary input. Prettier applied to both changed files. This isolated test run is not a full repository build, lint or hosted browser validation.

No provider or AI calls, production database writes, backfill, scheduled-job changes, Actions reruns, merge or deployment were performed. Preserve the paused news jobs and the private repository. Before integrating: inspect any newer head, run full quality checks, verify hosted preview and authenticated Passport/voice journeys, then use the existing authorized release workflow. Do not trigger paid usage to obtain green checks.
