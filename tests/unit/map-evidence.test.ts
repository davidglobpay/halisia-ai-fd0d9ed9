import { describe, expect, it } from "vitest";
import {
  evidenceTarget,
  MAP_CONTEXT_LAYERS,
  type MapEvidence,
} from "../../src/lib/map-evidence";
const item: MapEvidence = {
  id: "road",
  label: "Road",
  finding: "Mapped road nearby",
  evidenceClass: "open_data",
  source: "Synthetic test source",
  capturedAt: null,
  position: { lat: -1.2, lng: 36.8, accuracyM: null },
  supports: "Recorded road geometry",
  limitations: "Legal access unconfirmed",
};
describe("map evidence focus", () => {
  it("preserves unknown accuracy instead of inventing precision", () => {
    expect(evidenceTarget(item)?.accuracyM).toBeNull();
  });
  it("does not mutate the supplied position", () => {
    expect(evidenceTarget(item)).toEqual(item.position);
  });
  it.each([NaN, Infinity, 91, -91])("rejects invalid latitude %s", (lat) => {
    expect(
      evidenceTarget({ ...item, position: { lat, lng: 36, accuracyM: null } }),
    ).toBeNull();
  });
  it.each([NaN, Infinity, 181, -181])("rejects invalid longitude %s", (lng) => {
    expect(
      evidenceTarget({ ...item, position: { lat: 0, lng, accuracyM: null } }),
    ).toBeNull();
  });
  it.each([-1, NaN, Infinity])(
    "rejects invalid uncertainty %s",
    (accuracyM) => {
      expect(
        evidenceTarget({ ...item, position: { lat: 0, lng: 0, accuracyM } }),
      ).toBeNull();
    },
  );
  it.each(["source", "supports", "limitations"] as const)(
    "requires %s before map focus",
    (key) => {
      expect(evidenceTarget({ ...item, [key]: " " })).toBeNull();
    },
  );
  it("does not manufacture a location", () => {
    expect(evidenceTarget({ ...item, position: null })).toBeNull();
  });
  it("names reference layers honestly", () => {
    expect(MAP_CONTEXT_LAYERS.slope.label).toBe("Terrain hillshade");
    expect(MAP_CONTEXT_LAYERS.drainage.limitation).toContain(
      "not a site drainage",
    );
  });
});
