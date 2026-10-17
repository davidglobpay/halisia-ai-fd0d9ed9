/**
 * Seller submissions do not constitute a moderation decision.
 * This client-side guard is defense in depth, not database authorization.
 */
export function assertSellerModeration(input: { status?: string; review_state?: string }): void {
  if (input.status !== undefined && input.status !== "draft") {
    throw new Error("Seller changes must be submitted for review before publication.");
  }
  if (
    input.review_state !== undefined &&
    input.review_state !== "draft" &&
    input.review_state !== "in_review"
  ) {
    throw new Error("Listing approval requires an authorized moderation process.");
  }
}

export const SELLER_REVIEW_SUBMISSION = {
  status: "draft",
  review_state: "in_review",
} as const;
