import { afterEach, describe, expect, it } from "vitest";
import { getAiGatewayConfig, sanitizeMessages } from "../../src/lib/ai-gateway.server";

describe("AI gateway configuration", () => {
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_URL;
    delete process.env.AI_GATEWAY_AUTH_HEADER;
    delete process.env.AI_MODEL;
    delete process.env.AI_PROVIDER;
    delete process.env.LOVABLE_API_KEY;
  });

  it("supports an Astra-ready custom provider without hard-coding a vendor", () => {
    const config = getAiGatewayConfig({
      AI_GATEWAY_API_KEY: "test-key",
      AI_GATEWAY_URL: "https://example.test/v1/chat/completions",
      AI_MODEL: "astra",
      AI_PROVIDER: "openai",
    });
    expect(config).toMatchObject({
      model: "astra",
      provider: "openai",
      authHeader: "Authorization",
    });
  });

  it("retains the zero-change Lovable fallback", () => {
    const config = getAiGatewayConfig({ LOVABLE_API_KEY: "test-key" });
    expect(config).toMatchObject({
      provider: "lovable",
      authHeader: "Lovable-API-Key",
      model: "google/gemini-3-flash-preview",
    });
  });
});

describe("sanitizeMessages", () => {
  it("drops invalid messages and bounds conversation size and content", () => {
    const messages = sanitizeMessages([
      { role: "invalid", content: "ignored" },
      { role: "user", content: `  ${"x".repeat(9_000)}  ` },
      { role: "assistant", content: "   " },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages[0]?.content).toHaveLength(8_000);
  });
});
