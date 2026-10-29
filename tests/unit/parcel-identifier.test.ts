import { describe, expect, it } from "vitest";
import { looksLikeParcelIdentifier, PARCEL_IDENTIFIER_NOTICE } from "@/lib/parcel-identifier";

describe("a parcel identifier is never sent to the geocoder", () => {
  it.each([
    "KAJIADO/KITENGELA/8891",
    "Kiambu/Ruiru/2451",
    "NAIROBI/BLOCK 118/2451",
    "Nakuru/Njoro Ngata Block 2/345",
    "LR 209/1234",
    "L.R. No. 12345/67",
    "lr no 7785",
    "LR: 209/12/34",
    "title no. 1234",
    "plot no 45/2",
    "Parcel 778",
    "209/1234",
  ])("recognises %s", (q) => {
    expect(looksLikeParcelIdentifier(q)).toBe(true);
  });

  it.each([
    "Kitengela",
    "Ngong Road, Nairobi",
    "Ruiru",
    "-1.2921, 36.8219",
    "-1.2921 36.8219",
    "Eldama Ravine",
    "Plot near Juja town",
    "Moi Avenue 12",
    "Kilimani",
    "",
    "LR",
  ])("leaves %s to the map search", (q) => {
    expect(looksLikeParcelIdentifier(q)).toBe(false);
  });

  it("explains why and points to the deed tool", () => {
    expect(PARCEL_IDENTIFIER_NOTICE).toMatch(/Title Deed tool/);
    expect(PARCEL_IDENTIFIER_NOTICE).toMatch(/can't be located/);
  });
});
