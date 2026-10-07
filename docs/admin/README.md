# HALISIA master administrator

Route: /admin. Uses existing Supabase authentication and database.
The exact initial allowlist is ceo@globpay.ai, sammyosore64@gmail.com,
osoredavid644@gmail.com, dicksonnandwa4@gmail.com and osoredickson04@gmail.com.
The latter two screenshot addresses were matched to existing confirmed app
accounts. The remaining nandwadickson44… address must be entered in full before
authorization. Never infer an address from a label.

Confirmed allowlisted users receive the administrator role. Authorization
requires enabled allowlist membership, confirmed email, unsuspended account,
aal2 MFA and a session_id still present in auth.sessions. All existing admin
tools share this rule through has_role. Sign in normally, enroll an authenticator
from /admin, then verify its code. MFA recovery uses another authorized account
or trusted backend support; there is no universal password bypass.

The password setting updates the signed-in account through Supabase Auth after
checking current MFA. It uses masked inputs, password confirmation and memory
only; passwords are never stored in app tables, logs or browser localStorage.
Supabase may request its configured recovery/reauthentication flow. A chosen
password can be set individually; the app does not propagate it to other users.

The panel has overview counts, paginated account/record inspection, profile edits, supported
account activity filters, roles, listing moderation, contribution/credential
reviews, application suspension/restoration, admin allowlist management,
existing feature flags, the full Scout control room and links to Pulse controls.
Its directory includes accounts without a profile. Document browsing shows
metadata; private documents and Scout media can be opened with a reasoned,
audited access request and an authorized storage link expiring in 300 seconds.

Review mutations require a reason and record before/after values transactionally.
Existing Scout, pricing and marketplace admin writes also receive database audit
events, in addition to their existing workflow history. An administrator cannot
revoke their own admin email, directly delete an admin role, or suspend an admin
account before revoking its privilege. Non-admins cannot self-authorize.

Application suspension blocks authenticated RLS access, storage operations,
authenticated server middleware and database writes even through definer RPCs.
It does not claim to ban the Supabase login identity or revoke every session:
the account can authenticate but cannot access protected app data/actions.
Already downloaded content or existing signed URLs remain available until expiry.

Operations show provider health/ingestion logs, not uninstrumented whole-app
telemetry. Counts refresh every 30 seconds. Financial rows are recorded receipts,
transactions and commissions, not proof of bank settlement. Automatic checkout,
money movement and unimplemented commercial packages remain pending.

docs/admin/install.sql is the versioned installation script applied through the
Lovable database connector. The Supabase CLI is unavailable in this workspace;
no fabricated migration timestamp or CLI history entry was created.
Tests in tests/admin-database-rollback.sql simulate JWT assurance in a privileged
SQL test transaction, assert authorization and mutations, then roll back.
They do not constitute a real authenticator enrollment or owner browser sign-in.
