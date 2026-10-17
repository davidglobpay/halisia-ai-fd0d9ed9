import { describe, expect, it } from "vitest";
import { assertSellerModeration, SELLER_REVIEW_SUBMISSION } from "@/lib/seller-moderation";

describe("seller submissions never grant moderation approval", () => {
  it.each(["published", "sold", "rented", "archived", "unknown"])(
    "rejects seller-selected status %s",
    (status) => expect(() => assertSellerModeration({ status })).toThrow(/review/),
  );
  it.each(["approved", "rejected", "verified", "unknown"])(
    "rejects seller-selected review verdict %s",
    (review_state) => expect(() => assertSellerModeration({ review_state })).toThrow(/moderation/),
  );
  it("allows a normal submission while withholding public visibility and approval", () => {
    expect(SELLER_REVIEW_SUBMISSION).toEqual({ status: "draft", review_state: "in_review" });
    expect(() => assertSellerModeration(SELLER_REVIEW_SUBMISSION)).not.toThrow();
  });
  it("allows content-only edits without manufacturing a moderation decision", () => {
    expect(() => assertSellerModeration({})).not.toThrow();
    expect(() => assertSellerModeration({ status: "draft", review_state: "draft" })).not.toThrow();
  });
});
