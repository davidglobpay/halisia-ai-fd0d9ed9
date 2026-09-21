import { describe, expect, it } from "vitest";
import { findKenyaGazetteerPlace } from "@/lib/kenya-gazetteer";

describe("Kenya gazetteer fallback", () => {
  it.each([
    ["Nairobi CBD", "Nairobi CBD, Nairobi, Kenya"],
    ["Kisumu", "Kisumu, Kenya"],
    ["Mombasa, Kenya", "Mombasa, Kenya"],
    ["Karen, Nairobi", "Karen, Nairobi, Kenya"],
  ])("resolves %s deterministically", (query, address) => {
    const result = findKenyaGazetteerPlace(query);
    expect(result?.address).toBe(address);
    expect(result?.source).toBe("local-gazetteer");
    expect(Number.isFinite(result?.lat)).toBe(true);
    expect(Number.isFinite(result?.lng)).toBe(true);
  });

  it("does not invent an unknown place", () => {
    expect(findKenyaGazetteerPlace("Not A Real Kenyan Place 12345")).toBeNull();
  });
});
