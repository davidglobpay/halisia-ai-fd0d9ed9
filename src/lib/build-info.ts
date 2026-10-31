/**
 * A deliberate build identifier, bumped by hand on every ship.
 *
 * It exists because nothing else in this deployment proves which revision the
 * public URL is serving. The editor's commit SHA and the is_published flag say
 * what the project holds, not what the CDN returns, so "it is deployed" has
 * been an inference rather than a check — and at least once in this project it
 * was a wrong one: a route file was uploaded and reported live while the
 * generated route tree had not picked it up, so the page did not resolve.
 *
 * Rendered into the served HTML as a meta tag, so anyone verifying a release
 * can read the revision off the page itself rather than trust a dashboard.
 *
 * Bump BUILD_ID on every ship. A stale identifier is worse than none, because
 * it answers the question confidently and wrongly instead of not answering it.
 */
export const BUILD_ID = "2026-10-31.1";

/** What this build changed, in a few words. Non-sensitive by design. */
export const BUILD_NOTE = "Repeat PDF downloads on phones, phone-width layouts, honest amenity counts";
