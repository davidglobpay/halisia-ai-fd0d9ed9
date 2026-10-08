/**
 * Pricing table regression.
 *
 * Every figure a buyer is shown comes from src/lib/service-pricing.ts. These
 * tests exist because a price is the one thing in the app that is read by
 * somebody deciding whether to part with money, and a table of numbers is
 * exactly the kind of thing that drifts: a component price moves, and a
 * package that was a discount quietly becomes a markup; a plan's annual price
 * is edited and stops being ten months; a USD figure is typed with a zero too
 * many and a KES 490 report is offered abroad for the price of a flight.
 *
 * None of the savings shown to a buyer are written down anywhere. They are
 * derived from the component prices, so the arithmetic cannot be wrong on the
 * page while being right in the table. What is asserted below is that the
 * derivation produces the numbers the pricing page actually publishes.
 *
 * The last group reconciles against the Scout catalogue, which is priced
 * separately and is server-authoritative. The diaspora package advertises a
 * credit toward a Scout visit; if the Scout tasks were ever repriced upward,
 * that credit would stop covering a visit while still being described as
 * though it did.
 */
import { describe, expect, it } from "vitest";
import {
  PLANS,
  SERVICE_PRICES,
  BUNDLES,
  CURRENT_PLAN_ID,
  planById,
  serviceById,
  pricesForPath,
  bundleListKes,
  bundleSavingKes,
  annualSavingKes,
  priceKes,
  priceUsd,
  lowestOneOffKes,
  lowestBundleKes,
  lowestPaidPlanMonthlyKes,
} from "@/lib/service-pricing";
import { SCOUT_TASKS, previewQuote } from "@/lib/scout-pricing";

const bundle = (id: string) => BUNDLES.find((b) => b.id === id)!;
const plan = (id: string) => PLANS.find((p) => p.id === id)!;
const soldMonthly = PLANS.filter((p) => !p.quoteOnly && p.monthlyKes > 0);

describe("the tables are internally consistent", () => {
  it("has no duplicate identifiers", () => {
    for (const ids of [
      PLANS.map((p) => p.id),
      SERVICE_PRICES.map((s) => s.id),
      BUNDLES.map((b) => b.id),
    ]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it.each(SERVICE_PRICES.map((s) => [s.id, s] as const))(
    "service %s is a whole number of shillings and dollars",
    (_id, s) => {
      expect(Number.isInteger(s.amount)).toBe(true);
      expect(s.amount).toBeGreaterThan(0);
      expect(Number.isInteger(s.usd)).toBe(true);
      expect(s.usd!).toBeGreaterThan(0);
    },
  );

  it.each(SERVICE_PRICES.map((s) => [s.id, s] as const))(
    "service %s says what it is, what stays free and whether it is live",
    (_id, s) => {
      expect(s.scope.length).toBeGreaterThan(20);
      expect(s.free.length).toBeGreaterThan(10);
      expect(s.readiness.length).toBeGreaterThan(10);
      expect(s.paths.length).toBeGreaterThan(0);
    },
  );
});

describe("a year costs ten months", () => {
  it("five plans are sold monthly", () => {
    expect(soldMonthly).toHaveLength(5);
  });

  it.each(soldMonthly.map((p) => [p.id, p] as const))(
    "plan %s bills ten months for a year in both currencies",
    (_id, p) => {
      expect(p.annualKes).toBe(p.monthlyKes * 10);
      expect(p.annualUsd).toBe(p.monthlyUsd * 10);
      expect(annualSavingKes(p)).toBe(p.monthlyKes * 2);
      expect(p.annualKes).toBeLessThan(p.monthlyKes * 12);
    },
  );

  it("the free and quote-only plans advertise no annual saving", () => {
    expect(annualSavingKes(plan("free"))).toBe(0);
    expect(annualSavingKes(plan("institution"))).toBe(0);
  });

  it("the plan ladder ascends, so it can be read top to bottom", () => {
    const ladder = ["free", "plus", "pro", "seller", "studio", "api"];
    const prices = ladder.map((id) => plan(id).monthlyKes);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(prices.length);
  });
});

describe("a plan row in the service table never drifts from PLANS", () => {
  const planRows = SERVICE_PRICES.filter((s) => s.kind === "plan");

  it("there are three of them, for in-context display", () => {
    expect(planRows).toHaveLength(3);
  });

  it.each(planRows.map((r) => [r.id, r] as const))(
    "%s quotes the same price as the plan it points at",
    (_id, row) => {
      const p = planById(row.planId!);
      expect(p).toBeDefined();
      expect(row.amount).toBe(p!.monthlyKes);
      expect(row.usd).toBe(p!.monthlyUsd);
      expect(row.unit).toContain("per month");
    },
  );

  it("every one-off carries no plan id", () => {
    for (const s of SERVICE_PRICES.filter((x) => x.kind === "one_off")) {
      expect(s.planId).toBeUndefined();
    }
  });
});

describe("a package is always cheaper than its parts", () => {
  it.each(BUNDLES.map((b) => [b.id, b] as const))(
    "package %s costs less than buying its contents one at a time",
    (_id, b) => {
      const list = bundleListKes(b);
      expect(b.amountKes).toBeLessThan(list);
      expect(bundleSavingKes(b)).toBe(list - b.amountKes);
      expect(bundleSavingKes(b)).toBeGreaterThan(0);
    },
  );

  it.each(BUNDLES.map((b) => [b.id, b] as const))(
    "package %s is built from real one-off services, listed once each",
    (_id, b) => {
      expect(new Set(b.includes).size).toBe(b.includes.length);
      for (const id of b.includes) {
        const s = serviceById(id);
        expect(s, `${id} is not a service`).toBeDefined();
        expect(s!.kind).toBe("one_off");
      }
    },
  );

  // The published savings. A component price moving breaks these first.
  it.each([
    ["starter", 680, 90],
    ["buyer", 3260, 1270],
    ["builder", 7150, 3250],
    ["diaspora", 16150, 4250],
  ] as const)("package %s lists at %i and saves %i", (id, list, saving) => {
    expect(bundleListKes(bundle(id))).toBe(list);
    expect(bundleSavingKes(bundle(id))).toBe(saving);
  });

  it("the package ladder ascends", () => {
    const prices = ["starter", "buyer", "builder", "diaspora"].map(
      (id) => bundle(id).amountKes,
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("the cheapest package is still an easy decision on M-Pesa", () => {
    expect(lowestBundleKes()).toBeLessThan(1000);
  });
});

describe("the USD price is a premium, never a discount", () => {
  /**
   * The two currencies are set separately rather than converted, so nothing
   * here asserts an exchange rate. What it asserts is a band wide enough that
   * no honest price falls outside it and narrow enough to catch a typo — a
   * USD figure with a zero too many, or one that accidentally undercuts the
   * shilling price that card settlement is supposed to cost more than.
   */
  const priced: Array<[string, number, number]> = [
    ...SERVICE_PRICES.map(
      (s) => [s.id, s.amount, s.usd as number] as [string, number, number],
    ),
    ...soldMonthly.map(
      (p) => [p.id, p.monthlyKes, p.monthlyUsd] as [string, number, number],
    ),
    ...BUNDLES.map(
      (b) => [b.id, b.amountKes, b.amountUsd] as [string, number, number],
    ),
  ];

  it.each(priced)("%s implies a plausible shillings-per-dollar", (_id, kes, usd) => {
    const implied = kes / usd;
    expect(implied).toBeGreaterThanOrEqual(60);
    expect(implied).toBeLessThanOrEqual(200);
  });

  it.each(priced)("%s is not cheaper in dollars than in shillings", (_id, kes, usd) => {
    expect(kes / usd).toBeLessThanOrEqual(130);
  });
});

describe("the landing page's three 'from' figures are real rows", () => {
  it("the cheapest one-off is below the government search fee", () => {
    expect(lowestOneOffKes()).toBe(190);
    expect(lowestOneOffKes()).toBeLessThan(500);
  });

  it("each 'from' figure resolves to something that can be bought", () => {
    expect(
      SERVICE_PRICES.some(
        (s) => s.kind === "one_off" && s.amount === lowestOneOffKes(),
      ),
    ).toBe(true);
    expect(BUNDLES.some((b) => b.amountKes === lowestBundleKes())).toBe(true);
    expect(
      PLANS.some(
        (p) => !p.quoteOnly && p.monthlyKes === lowestPaidPlanMonthlyKes(),
      ),
    ).toBe(true);
  });

  it("one report costs less than a month of the cheapest plan", () => {
    expect(lowestOneOffKes()).toBeLessThan(lowestPaidPlanMonthlyKes());
  });
});

describe("prices appear on the pages they belong to", () => {
  // The eight services that existed before the table was segmented must still
  // appear where they appeared, so no page silently loses its pricing strip.
  it.each([
    ["/passport", "passport"],
    ["/report", "passport"],
    ["/reports", "passport"],
    ["/title-deed", "dossier"],
    ["/compare", "compare"],
    ["/compare-locations", "compare"],
    ["/design-studio", "design"],
    ["/model-lab", "design"],
    ["/spatial", "design"],
    ["/marketplace", "listing"],
    ["/sell", "listing"],
    ["/seller-tools", "seller"],
    ["/rentals", "seller"],
    ["/connections", "professional"],
    ["/pros", "professional"],
    ["/pro-profile", "professional"],
    ["/mcp", "api"],
  ])("%s still offers %s", (path, id) => {
    expect(pricesForPath(path).some((p) => p.id === id)).toBe(true);
  });

  it.each(
    SERVICE_PRICES.flatMap((s) => s.paths.map((p) => [s.id, p] as const)),
  )("%s is reachable from its own path %s", (id, path) => {
    expect(pricesForPath(path).some((x) => x.id === id)).toBe(true);
  });

  it("matches whole path segments, not bare prefixes", () => {
    expect(pricesForPath("/marketplace/123").length).toBeGreaterThan(0);
    expect(pricesForPath("/sellers").some((p) => p.id === "listing")).toBe(false);
    expect(pricesForPath("/nowhere")).toHaveLength(0);
  });
});

describe("nothing is gated behind a price", () => {
  /**
   * Payment integration replaces CURRENT_PLAN_ID with the plan recorded
   * against the signed-in account. Until it does, every account is on the free
   * plan and no tool checks it, which is what lets the pricing be published
   * ahead of billing without taking anything away from anyone.
   */
  it("every browser is on the free plan", () => {
    expect(CURRENT_PLAN_ID).toBe("free");
  });

  it("the free plan costs nothing in either currency", () => {
    expect(plan("free").monthlyKes).toBe(0);
    expect(plan("free").monthlyUsd).toBe(0);
    expect(plan("free").annualKes).toBe(0);
  });

  it("the free plan lists what it covers, so the promise is checkable", () => {
    expect(plan("free").includes.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the Scout credit covers a Scout visit", () => {
  const fullEasy = previewQuote(
    Object.fromEntries(SCOUT_TASKS.map((t) => [t.code, "check" as const])),
    "easy",
    0,
  );

  it("quotes the Scout prices the pricing page publishes", () => {
    expect(previewQuote({}, "easy", 0).totalKes).toBe(1150);
    expect(fullEasy.totalKes).toBe(5635);
  });

  it("the diaspora credit pays for a full checklist visit", () => {
    const credit = bundle("diaspora").extras!.find((e) =>
      e.label.includes("Scout"),
    )!;
    expect(credit).toBeDefined();
    expect(credit.kes).toBeGreaterThanOrEqual(fullEasy.totalKes);
    // and is not so far above one that the package is padded
    expect(credit.kes).toBeLessThanOrEqual(fullEasy.totalKes * 1.5);
  });

  it("the Plus year inside the diaspora package is the real Plus price", () => {
    const plus = bundle("diaspora").extras!.find((e) =>
      e.label.includes("Plus"),
    )!;
    expect(plus.kes).toBe(plan("plus").annualKes);
  });

  it("no service id collides with a Scout catalogue code", () => {
    const codes = [
      "base",
      "platform_fee_pct",
      "access_easy",
      "access_difficult",
      "access_remote",
      ...SCOUT_TASKS.map((t) => t.code),
    ];
    for (const s of SERVICE_PRICES) expect(codes).not.toContain(s.id);
  });
});

describe("currency formatting", () => {
  it.each([
    [11900, "KES 11,900"],
    [190, "KES 190"],
    [0, "KES 0"],
  ])("priceKes(%i) is %s", (n, out) => expect(priceKes(n)).toBe(out));

  it.each([
    [99, "USD 99"],
    [3800, "USD 3,800"],
  ])("priceUsd(%i) is %s", (n, out) => expect(priceUsd(n)).toBe(out));
});
