import { describe, expect, it } from "vitest";

import {
  MAX_INSPIRATION_IMAGES,
  bytesToBase64,
  parseInspirationInput,
  previewImageFromHtml,
  safeHttpUrl,
  youtubeId,
} from "@/lib/design-inspiration";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("inspiration input", () => {
  it("accepts pictures, a link and a note", () => {
    const v = parseInspirationInput({
      images: [PNG],
      link: " https://www.pinterest.com/pin/123/ ",
      note: "stone walls",
    });
    expect(v.images).toHaveLength(1);
    expect(v.link).toBe("https://www.pinterest.com/pin/123/");
    expect(v.note).toBe("stone walls");
  });
  it("needs at least one picture or link", () => {
    expect(() => parseInspirationInput({ images: [], link: "" })).toThrow(/Add a picture/);
  });
  it("rejects too many pictures, non-pictures and bad links", () => {
    expect(() =>
      parseInspirationInput({ images: Array(MAX_INSPIRATION_IMAGES + 1).fill(PNG) }),
    ).toThrow(/At most/);
    expect(() => parseInspirationInput({ images: ["data:text/html;base64,PGI+"] })).toThrow(
      /JPEG, PNG or WebP/,
    );
    expect(() => parseInspirationInput({ link: "javascript:alert(1)" })).toThrow(/web address/);
  });
});

describe("link safety", () => {
  it("allows public web addresses", () => {
    expect(safeHttpUrl("https://example.co.ke/house.jpg")).not.toBeNull();
  });
  it("refuses local, internal and bare-IP addresses and credentials", () => {
    for (const bad of [
      "http://localhost:8080/",
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://intranet/",
      "https://printer.local/",
      "https://user:pass@example.com/",
      "ftp://example.com/x.jpg",
    ])
      expect(safeHttpUrl(bad)).toBeNull();
  });
});

describe("YouTube links", () => {
  it("finds the video id in the usual shapes", () => {
    const id = "dQw4w9WgXcQ";
    for (const link of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://m.youtube.com/watch?v=${id}&t=30`,
    ])
      expect(youtubeId(new URL(link))).toBe(id);
    expect(youtubeId(new URL("https://example.com/watch?v=" + id))).toBeNull();
  });
});

describe("page preview image", () => {
  it("reads og:image in either attribute order and resolves relative paths", () => {
    expect(
      previewImageFromHtml(
        `<head><meta content="/img/house.jpg" property="og:image"></head>`,
        "https://homes.example.com/listing/1",
      ),
    ).toBe("https://homes.example.com/img/house.jpg");
    expect(
      previewImageFromHtml(
        `<meta name="twitter:image" content="https://cdn.example.com/a.png?x=1&amp;y=2">`,
        "https://example.com/",
      ),
    ).toBe("https://cdn.example.com/a.png?x=1&y=2");
  });
  it("returns null when there is none or it points somewhere unsafe", () => {
    expect(
      previewImageFromHtml("<html><title>x</title></html>", "https://example.com/"),
    ).toBeNull();
    expect(
      previewImageFromHtml(
        `<meta property="og:image" content="http://127.0.0.1/a.jpg">`,
        "https://example.com/",
      ),
    ).toBeNull();
  });
});

describe("base64", () => {
  it("encodes bytes like btoa", () => {
    expect(bytesToBase64(new Uint8Array([72, 105, 33]))).toBe("SGkh");
  });
});
