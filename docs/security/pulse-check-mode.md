# Pulse authentication-only check

POST with body {"mode":"check"} validates the existing x-cron-secret and returns {ok:true,mode:"check"} before dynamically importing ingestion. It does not run providers, AI, trending or archiving. Missing, incorrect and unconfigured credentials remain HTTP 401. It never returns the secret or its length.

Four isolated Node VM handler tests passed on 19 October 2026. The harness removes only TypeScript declarations/casts and stubs route registration; it is not a substitute for the full TypeScript/build suite or hosted verification. Run: node --test tests/pulse-check.node.test.mjs.

The three configured pg_cron jobs remain paused. A valid-key hosted request cannot be checked through this mode until this revision is built in preview. Use Vault inside SQL to attach the header, never print the key. Verify wrong/missing key HTTP401 and valid check HTTP200 before enabling any jobs. Hourly/nightly AI and authenticated news-provider usage require separate zero-cost verification; do not enable paid usage.
