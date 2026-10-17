# Release blockers, 17 October 2026

Connected release: 3353b5580f1648cc14ed95fad175e88f2b7f87ce, build 2026-10-17.3.

Candidate marketplace repair redirects seller publication/approval to draft/in_review and requeues approved seller content changes. Existing score/featured/view counter protection is preserved. Existing audited MFA administrator action atomically sets approval when publishing, without adding admin roles or broadening RLS.

Rollback-only synthetic temporary-table tests passed for insert publication/approval and update publication/approval. No production listings or rules changed. These tests do not prove full PostgREST/RLS/admin journeys. Validate published-content edits, other-owner, anonymous, suspended, MFA administrator and trusted backend behavior before applying candidate SQL.

All three Pulse refresh jobs are active without x-cron-secret; no Pulse/cron key entry exists in Vault. The connector has no app-secret-setting operation. An owner must securely configure matching app PULSE_CRON_SECRET and database Vault value and job headers; do not put secrets in Git or chat. Never weaken the endpoint authentication to restore refresh.

Publication remains pending hosted build and signed-in release verification. No paid Actions or Lovable credits used.
