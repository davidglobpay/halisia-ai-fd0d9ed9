import { describe, expect, it } from "vitest";
import { partnerCommercialDisclosure } from "../../src/lib/partner-commercial-disclosure";
describe("commercial disclosure authority", () => {
  it("does not equate outreach with an agreement", () => {
    expect(partnerCommercialDisclosure("outreach_pending")).toContain(
      "does not confirm a commercial agreement",
    );
  });
  it.each(["referral_partner", "sales_partner"])(
    "does not invent contract terms for %s",
    (status) => {
      const text = partnerCommercialDisclosure(status);
      expect(text).toContain("fee rate and payer have not been confirmed");
      expect(text).not.toContain("paid by the company");
    },
  );
  it("labels discovery as a recorded status", () => {
    expect(partnerCommercialDisclosure("discovery_only")).toContain("recorded as discovery-only");
  });
  it.each([null, undefined, "", "future_unknown"])("fails closed for %s", (status) => {
    expect(partnerCommercialDisclosure(status)).toContain("Commercial arrangement not confirmed");
  });
});
