/** Display-only proposal. Never creates a payable fee or verifies a payment. */
export const PROPOSED_MARKETPLACE_COMMISSION_PCT = 2;
export function proposedCommissionKes(
  price: unknown,
  currency: string | null | undefined,
): number | null {
  if (currency && currency.toUpperCase() !== "KES") return null;
  if (price === null || price === undefined || price === "") return null;
  const amount =
    typeof price === "number"
      ? price
      : typeof price === "string"
        ? Number(price)
        : NaN;
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > Number.MAX_SAFE_INTEGER / 100
  )
    return null;
  return Math.round(amount * PROPOSED_MARKETPLACE_COMMISSION_PCT) / 100;
}
