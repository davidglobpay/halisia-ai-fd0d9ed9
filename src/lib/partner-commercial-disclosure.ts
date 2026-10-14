/** A source status is not proof of an active contract, fee rate or payer. */
export function partnerCommercialDisclosure(status: string | null | undefined): string {
  switch (status) {
    case "outreach_pending":
      return "Partnership outreach is pending. This status does not confirm a commercial agreement or referral fee.";
    case "referral_partner":
    case "sales_partner":
      return "This source is marked as a referral or sales partner. A referral fee may apply; the active agreement, fee rate and payer have not been confirmed on this page.";
    case "discovery_only":
      return "This source is recorded as discovery-only. No commercial agreement or referral fee is confirmed on this page.";
    default:
      return "Commercial arrangement not confirmed. Do not assume a referral fee or who pays it.";
  }
}
