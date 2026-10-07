import { describe, expect, it } from "vitest";
import { previewQuote, SCOUT_TASKS } from "@/lib/scout-pricing";

describe("scout pricing", () => {
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
