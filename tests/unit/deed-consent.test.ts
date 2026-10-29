import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("deed text leaves the browser only with consent", () => {
  const page = read("src/routes/title-deed.tsx");

  it("refuses to process an upload without consent", () => {
    expect(page).toMatch(/if \(!file \|\| !aiConsent\) return;/);
  });

  it("keeps the extract button disabled until consent is given", () => {
    expect(page).toMatch(/disabled=\{busy \|\| !aiConsent\}/);
  });

  it("asks again for every new file", () => {
    expect(page).toMatch(/setFile\(f\);\s*setAiConsent\(false\);/);
  });

  it("names the processor and what is sent", () => {
    expect(page).toMatch(/Gemini/);
    expect(page).toMatch(/owner&apos;s name/);
    expect(page).toMatch(/to="\/privacy"/);
  });
});

describe("the privacy page states only what the code does", () => {
  const privacy = read("src/routes/privacy.tsx");
  const extract = read("src/lib/deed-extract.functions.ts");
  const ocr = read("src/routes/title-deed.tsx");

  it("is registered as a route", () => {
    expect(read("src/routeTree.gen.ts")).toMatch(/'\/privacy': typeof PrivacyRoute/);
  });

  it("says the image is read in the browser, which is true", () => {
    expect(privacy).toMatch(/read in your own browser/);
    expect(ocr).toMatch(/import\("tesseract\.js"\)/);
  });

  it("says deed text is not stored, which is true", () => {
    expect(privacy).toMatch(/does not store the deed text/);
    expect(extract).not.toMatch(/\.from\(|\.insert\(|storage\./);
  });

  it("says the AI model it names is the one the code calls", () => {
    expect(privacy).toMatch(/Gemini/);
    expect(extract).toMatch(/google\/gemini/);
  });

  it("does not claim a registry connection", () => {
    expect(privacy).toMatch(/no connection to any land registry/);
  });
});
