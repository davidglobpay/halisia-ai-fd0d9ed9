/** Transparent, deterministic financing maths. No AI involved. */
export type LoanInput = {
  projectCost: number;
  equity: number;
  annualRatePct: number;
  years: number;
  monthlyRent?: number;
  monthlyOpex?: number;
};

export type LoanResult = {
  loanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  totalRepaid: number;
  equityPct: number;
  netMonthlyCashflow: number | null;
  dscr: number | null;
};

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function computeLoan(i: LoanInput): LoanResult {
  const cost = Math.max(0, i.projectCost || 0);
  const equity = Math.min(cost, Math.max(0, i.equity || 0));
  const loanAmount = cost - equity;
  const pmt = monthlyPayment(loanAmount, i.annualRatePct, i.years);
  const totalRepaid = pmt * Math.round(i.years * 12);
  const hasRent = typeof i.monthlyRent === "number" && i.monthlyRent > 0;
  const noi = hasRent ? i.monthlyRent! - (i.monthlyOpex ?? 0) : null;
  return {
    loanAmount,
    monthlyPayment: pmt,
    totalInterest: Math.max(0, totalRepaid - loanAmount),
    totalRepaid,
    equityPct: cost ? (equity / cost) * 100 : 0,
    netMonthlyCashflow: noi == null ? null : noi - pmt,
    dscr: noi == null || pmt === 0 ? null : noi / pmt,
  };
}

export const FINANCE_DOCS = [
  "Copy of title deed and recent official search",
  "National ID / KRA PIN of all borrowers",
  "6–12 months bank statements and payslips or audited accounts",
  "Approved building plans (for construction loans)",
  "Bill of quantities from a registered quantity surveyor",
  "Valuation report from a registered valuer",
  "County rates and land rent clearance",
];

export const FINANCE_DISCLAIMER =
  "Indicative estimate only. Rates, fees and approval depend on the lender. This is not a loan offer, approval or promise of returns.";
