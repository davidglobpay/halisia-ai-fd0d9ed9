# Seller review workflow — 17 October 2026

Base: 6458359fa998266abc3b17b59c518006e76f7f01. This is a partial client workflow repair, not a completed authorization fix or release certificate.

## Confirmed finding

Both seller create/edit routes offered immediate publication and wrote status=published and review_state=approved directly from a checkbox. This contradicted their submit-for-review workflow.

Read-only production catalog inspection found owner INSERT/UPDATE policies, and an INSERT/UPDATE trigger named trg_halisia_guard_property_system_fields. Its function protects ai_score, featured and view_count, but does not restrict status or review_state. No production records were read or modified for this assessment. Existing financing hardening remains intact.

## Implemented

- Seller create/edit submissions now write draft/in_review, with no immediate-publication checkbox or approved verdict.
- Both routes explicitly explain that submission is not title, ownership or location verification.
- The shared property helpers reject seller-selected publication statuses and approval/rejection verdicts before making a network request. Content-only edits still work.
- Editing and resubmitting a published listing removes it from public view pending moderation; the UI explains this behavior.

These checks are client-side defense in depth. A caller can bypass them by using the database API directly. Do not close the security finding based on this patch.

## Exact next action

Implement and test a database-level moderation rule for INSERT and UPDATE, preserving the existing system-field protections, trusted backend path, owner isolation, suspended-account restrictions and authorized admin workflow. Establish the actual privileged moderator action before enabling publication; the owner policies alone do not authorize admins to update other owners' rows. Do not invent an admin role assignment or broaden access to silence a failing test.

Test owner self-publication/approval denial; allowed drafts/submissions; moderation rejection; changes to previously approved content; admin moderation through the real authorized path; anonymous, suspended and other-owner denial; trusted backend behavior; direct API calls; rollback and replay. Use isolated synthetic data, not production exploit attempts.

Existing table-wide TRUNCATE/TRIGGER/REFERENCES grants to anon/authenticated on properties also warrant least-privilege review. SQL-role grant inspection is not proof those operations are publicly exposed by PostgREST.

After database enforcement and hosted role tests pass, reconcile this branch, rerun release checks and refresh the security scan. Keep production unchanged while material gates remain unresolved.

## Official Kenyan context checked 17 October 2026

- State Department for Lands, 3 September 2026: Ardhisasa live in Nairobi, Murang'a, Mombasa and Isiolo; Ardhipay and the National Stamp Duty Module are separate official services. https://www.lands.go.ke/state-department-lands-accelerates-digital-transformation-land-services
- State Department for Lands, 17 July 2026: specified additional Mombasa registration blocks onboarded effective 20 July 2026. This is not proof of complete nationwide parcel coverage. https://lands.go.ke/state-department-lands-expands-digitization-mombasa-bringing-more-land-transactions-ardhisasa
- The article “Parliament Seeks More Funds” is dated 19 February 2026 despite a search/index snippet showing 5 October; use the article date and do not announce it as an October development. https://lands.go.ke/parliament-seeks-more-funds-boost-lands-digitization-and-services

None of these announcements gives HALISIA registry access, title validation or government integration. Seller claims, open-data indicators, professional attestations and model inferences must retain separate evidence labels.
