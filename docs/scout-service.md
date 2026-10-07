# HALISIA Send a Scout

Entry points: `/title-deed` results, `/contributions`, and authenticated `/scout`.

The service reuses existing authentication, contributor navigation, private Supabase Storage and PDF generation. It does not require an external checkout subscription. Current prices are editable pilot suggestions, not surveyed market prices.

Base visit: KES 1,000, eight photos and one short video. Optional tasks total KES 3,900. HALISIA fee: 15% of base plus activities, excluding travel/access. Base-only total: KES 1,150; full checklist total: KES 5,635, before travel/access. Difficult/remote allowances: KES 500 / 1,500 as estimates. Travel is quoted at cost. Buyers must accept revisions; server snapshots determine the authoritative charge.

## One-time operational setup

1. The owner registers/signs in to HALISIA. Assign the verified owner account the existing administrator role through the trusted database administrator connection. Never expose role grants or service keys to the browser. No administrator existed when this feature was built, and no role was granted to a guessed account.
2. In `/scout`, administration, configure actual payee instructions and enable manual payments. Until then the service intentionally permits quote requests only.
3. Scouts register service counties, availability and experience. An administrator verifies each scout and approves them. Approval is not automatic.
4. Buyers accept quotes and submit real payment references. An administrator checks the bank/M-Pesa statement and enters each newly received amount. Duplicate references are blocked. Dispatch starts only after full verified payment. Automatic Globpay checkout, escrow and payouts are not configured or represented as working.

## Delivery

Approved scouts accept eligible jobs, disclose conflicts, start a visit, save findings and upload media. Date/time is entered as actual capture time; device GPS is explicitly described as upload-session location rather than proof of capture location. An evidence file must exist in the private bucket and match its stored media type/size. Uploads are limited to 50 MB per file and may be retried. Interrupted browser sessions preserve text, but require file reselection. Testimony requires consent.

Eight base photos and a video are required. Each selected task needs findings/evidence or a documented blocked reason. An administrator may approve a reasoned exception. Revised findings/corrections reset that approval. A different administrator reviews the final report; a buyer/scout cannot approve their own report. PDFs include findings, evidence metadata and embeddable JPEG/PNG images; private videos and WebP originals remain accessible inside the authenticated report.

Reviewed findings appear in the buyer's Land Passport by title reference as a separate human evidence layer. Contradictions are flagged; AI scores and title/location verification are not silently upgraded. No model training occurs automatically.

Refunds and scout payouts are performed outside the app and recorded using real transfer references. The app tracks the received amount, balance and refund liability; it does not execute money movements.

## Validation

Full TypeScript check and production build; pricing and UI tests; live transactional database tests with rollback for pricing, private access, function/table privileges, job claiming, phantom media rejection, payment balances and refunds. No test accounts/bookings/payments were retained. Real authenticated media capture/transfer and a paid scout visit still require operational setup and a pilot.
