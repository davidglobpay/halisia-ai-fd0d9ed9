import { describe, expect, it } from "vitest";
import { applicantFinancingPatch } from "@/lib/financing-input";

describe("applicant financing updates", () => {
  it.each(["draft", "submitted", "withdrawn"] as const)("allows applicant status %s", (status) => {
    expect(applicantFinancingPatch({ status, notes: "Applicant-supplied note" })).toEqual({
      status,
      notes: "Applicant-supplied note",
    });
  });
  it.each(["under_review", "approved", "funded", "rejected"] as const)(
    "rejects decision %s before a database call",
    (status) => {
      expect(() => applicantFinancingPatch({ status })).toThrow("authorized backend");
    },
  );
  it.each([
    "id",
    "applicant_id",
    "lender_name",
    "created_at",
    "updated_at",
    "ai_summary",
    "readiness",
    "shared_report_url",
  ])("rejects protected field %s", (key) => {
    expect(() => applicantFinancingPatch({ [key]: "not allowed" })).toThrow(
      "cannot update financing field",
    );
  });
  it("preserves applicant data and does not mutate the caller", () => {
    const patch = { borrower_name: "Synthetic applicant", requested_amount: 1, notes: null };
    const out = applicantFinancingPatch(patch);
    expect(out).toEqual(patch);
    expect(out).not.toBe(patch);
  });
});
