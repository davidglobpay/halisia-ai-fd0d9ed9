# Moderation repair applied

17 October 2026: production functions halisia_guard_property_system_fields and halisia_private.admin_action repaired, preserving existing system-controlled fields, MFA/allowlist checks and audited admin path. No RLS access broadening or role assignment persisted.

Rollback-only synthetic database tests passed: seller insert/update publication and approval withheld; non-MFA admin action rejected; synthetic confirmed/allowlisted MFA-session administrator publishes with approved review state; seller content edit returns an approved listing to draft/in_review. Verified synthetic users did not remain after rollback. Applied function updates under exact-original-definition leases, then re-read both definitions and confirmed repairs present.

No existing listing rows were changed by the repair. Tests are database-level simulated JWT-context tests, not proof of browser authentication or all REST/RLS journeys. Publication remains pending hosted release gates and Pulse secret setup. No matching Pulse/cron Vault key exists, and the connector cannot set the application PULSE_CRON_SECRET.
