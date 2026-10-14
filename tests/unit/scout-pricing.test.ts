import { describe, expect, it } from "vitest";
import { previewQuote, SCOUT_TASKS } from "@/lib/scout-pricing";

describe("scout pricing", () => {
  it("base-only visit is 1150 before transport", () => {
    expect(previewQuote({}, "easy", 0).totalKes).toBe(1150);
  });
  it("uses current administrator prices and excludes inactive tasks", () => {
    const catalog = [
      { code: "base", amount_kes: 1200, active: true },
      { code: "platform_fee_pct", amount_kes: 10, active: true },
      { code: "roads", amount_kes: 450, active: true },
      { code: "terrain", amount_kes: 500, active: false },
      { code: "access_easy", amount_kes: 0, active: true },
    ];
    const q = previewQuote({ roads: "check", terrain: "unsure" }, "easy", 200, catalog);
    expect(q.scoutWorkKes).toBe(1650);
    expect(q.platformFeeKes).toBe(165);
    expect(q.totalKes).toBe(2015);
  });
  it("unselected checks never add a charge", () => {
    expect(previewQuote({ roads: "not", terrain: "not" }, "difficult", 250).totalKes).toBe(1900);
  });
  it("full checklist before travel = 5635", () => {
    const all = Object.fromEntries(SCOUT_TASKS.map((t) => [t.code, "check" as const]));
    const q = previewQuote(all, "easy", 0);
    expect(q.scoutWorkKes).toBe(4900);
    expect(q.platformFeeKes).toBe(735);
    expect(q.totalKes).toBe(5635);
  });
  it("unsure charged once, fee excludes travel/access", () => {
    const q = previewQuote({ roads: "unsure" }, "remote", 800);
    expect(q.tasksKes).toBe(300);
    expect(q.platformFeeKes).toBe(195);
    expect(q.totalKes).toBe(1300 + 195 + 800 + 1500);
  });
});
