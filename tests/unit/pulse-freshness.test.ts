import { describe, expect, it } from "vitest";
import {
  formatPulseDate,
  pulseFreshness,
  pulseStaleMessage,
  PULSE_STALE_AFTER_HOURS,
} from "@/lib/pulse-freshness";

const NOW = Date.parse("2026-10-28T18:00:00Z");

describe("the Pulse feed says when it is out of date", () => {
  it("is current within the window", () => {
    const f = pulseFreshness("2026-10-28T06:00:00Z", NOW);
    expect(f.state).toBe("current");
    expect(pulseStaleMessage(f)).toBeNull();
  });

  it("is current exactly at the threshold", () => {
    const at = new Date(NOW - PULSE_STALE_AFTER_HOURS * 3_600_000).toISOString();
    expect(pulseFreshness(at, NOW).state).toBe("current");
  });

  it("is stale after the threshold, with whole days", () => {
    const f = pulseFreshness("2026-10-17T15:49:22Z", NOW);
    expect(f).toEqual({ state: "stale", newestAt: "2026-10-17T15:49:22Z", daysOld: 11 });
  });

  it("names the date and says updates are paused", () => {
    const msg = pulseStaleMessage(pulseFreshness("2026-10-17T15:49:22Z", NOW));
    expect(msg).toMatch(/17 Oct 2026/);
    expect(msg).toMatch(/11 days ago/);
    expect(msg).toMatch(/not current/);
  });

  it("claims nothing when there is no date", () => {
    expect(pulseFreshness(null, NOW).state).toBe("unknown");
    expect(pulseFreshness("not a date", NOW).state).toBe("unknown");
    expect(pulseStaleMessage(pulseFreshness(undefined, NOW))).toBeNull();
  });

  it("dates in Kenyan time", () => {
    // 22:30 UTC on 17 Oct is already 18 Oct in Nairobi.
    expect(formatPulseDate("2026-10-17T22:30:00Z")).toBe("18 Oct 2026");
  });
});
