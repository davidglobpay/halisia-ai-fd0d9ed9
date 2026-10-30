import { describe, expect, it } from "vitest";
import { createRateLimiter, parseCoordInput, parseTtsInput } from "@/lib/request-guards";
import { secretsMatch } from "@/lib/cron-secret.server";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("article audio input", () => {
  it("accepts an article UUID and lower-cases it", () => {
    expect(parseTtsInput({ articleId: ID.toUpperCase() })).toEqual({ articleId: ID });
  });

  it("accepts each known engine", () => {
    for (const engine of ["elevenlabs", "azure", "google"]) {
      expect(parseTtsInput({ articleId: ID, engine }).engine).toBe(engine);
    }
  });

  it("treats a null engine as automatic", () => {
    expect(parseTtsInput({ articleId: ID, engine: null })).toEqual({ articleId: ID });
  });

  it("rejects a missing or malformed article id", () => {
    for (const bad of [
      undefined,
      null,
      {},
      { articleId: "" },
      { articleId: "123" },
      { articleId: 7 },
    ]) {
      expect(() => parseTtsInput(bad)).toThrow(/articleId/);
    }
  });

  it("rejects an unknown engine instead of passing it to a provider", () => {
    expect(() => parseTtsInput({ articleId: ID, engine: "openai" })).toThrow(/engine/);
    expect(() => parseTtsInput({ articleId: ID, engine: 1 })).toThrow(/engine/);
  });
});

describe("coordinate input", () => {
  it("accepts a Kenyan point and defaults refresh to false", () => {
    expect(parseCoordInput({ lat: -1.4, lng: 36.96 })).toEqual({
      lat: -1.4,
      lng: 36.96,
      refresh: false,
    });
  });

  it("only honours an explicit boolean refresh", () => {
    expect(parseCoordInput({ lat: 0, lng: 0, refresh: true }).refresh).toBe(true);
    expect(parseCoordInput({ lat: 0, lng: 0, refresh: "yes" }).refresh).toBe(false);
  });

  it("accepts the range edges", () => {
    expect(parseCoordInput({ lat: -90, lng: 180 })).toEqual({ lat: -90, lng: 180, refresh: false });
  });

  it("rejects missing, non-finite and out-of-range values", () => {
    expect(() => parseCoordInput(undefined)).toThrow(/lat\/lng/);
    expect(() => parseCoordInput({ lat: "1", lng: 36 })).toThrow(/lat\/lng/);
    expect(() => parseCoordInput({ lat: Number.NaN, lng: 36 })).toThrow(/lat/);
    expect(() => parseCoordInput({ lat: 91, lng: 36 })).toThrow(/lat/);
    expect(() => parseCoordInput({ lat: 0, lng: Number.POSITIVE_INFINITY })).toThrow(/lng/);
    expect(() => parseCoordInput({ lat: 0, lng: -180.01 })).toThrow(/lng/);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per key within the window", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 10)).toBe(true);
    expect(allow("a", 20)).toBe(false);
    expect(allow("b", 20)).toBe(true);
  });

  it("starts a fresh window once the old one has passed", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 999)).toBe(false);
    expect(allow("a", 1000)).toBe(true);
  });

  it("bounds memory by clearing when too many callers are tracked", () => {
    const allow = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("b", 0)).toBe(true);
    expect(allow("c", 0)).toBe(true);
    expect(allow("a", 1)).toBe(true);
  });
});

describe("cron secret comparison", () => {
  it("matches only the exact secret", async () => {
    expect(await secretsMatch("synthetic-key", "synthetic-key")).toBe(true);
    expect(await secretsMatch("synthetic-kez", "synthetic-key")).toBe(false);
    expect(await secretsMatch("synthetic-key-longer", "synthetic-key")).toBe(false);
    expect(await secretsMatch("", "synthetic-key")).toBe(false);
  });

  it("never matches when the expected secret is unset", async () => {
    expect(await secretsMatch("", "")).toBe(false);
    expect(await secretsMatch("anything", "")).toBe(false);
  });
});
