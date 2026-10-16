# Financing authorization regression harness

Run `npm ci --ignore-scripts` here, then `node check.mjs`. This separate pinned
PGlite dependency is not a production application dependency.

The harness reconstructs the retrieved financing table columns, policies,
grants, status guard and suspension/admin checks in an isolated PostgreSQL WASM
database. Auth users, sessions, roles and records are synthetic; JWT claims are
simulated PostgreSQL request settings. No production records are read or written.
Foreign keys and unrelated tables are outside this test's scope. This is not a
live Supabase/PostgREST, actual MFA or real JWT-validation integration test.

It tests the retrieved production configuration and then the exact migration:
owner submission/withdrawal; denial of owner decision updates; cross-user,
suspended and anonymous restrictions; retained service-role decisions; retained
absence of cross-user administrator UPDATE access; INSERT decision-status
bypass; and table-level TRUNCATE grants. TRUNCATE is exercised only on disposable
synthetic rows. Database-role privilege does not by itself prove a remotely
exposed PostgREST TRUNCATE endpoint exists.

The migration adds INSERT to the existing decision guard and revokes unnecessary
TRUNCATE, TRIGGER and REFERENCES grants from anonymous/authenticated roles. It
does not grant new administrator access or alter stored application records.
It includes a function-definition lease: if another agent changes the guard,
application fails rather than overwriting their work.

`rollback.sql` restores the exact previously retrieved guard and its prior grants.
Rollback restores known vulnerabilities; use only for a demonstrated regression,
never to clear a security finding. Review before application. Generated
`results.json` records observations and is excluded from version control.
