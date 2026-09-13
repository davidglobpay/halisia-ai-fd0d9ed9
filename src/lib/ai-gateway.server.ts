export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiGatewayConfig = {
  url: string;
  apiKey: string;
  authHeader: string;
  model: string;
  provider: string;
};

export class AiGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "not_configured" | "rate_limited" | "credits_exhausted" | "upstream" | "timeout",
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export function getAiGatewayConfig(env: NodeJS.ProcessEnv = process.env): AiGatewayConfig | null {
  const customKey = env.AI_GATEWAY_API_KEY?.trim();
  const lovableKey = env.LOVABLE_API_KEY?.trim();
  const apiKey = customKey || lovableKey;
  if (!apiKey) return null;

  return {
    url: env.AI_GATEWAY_URL?.trim() || "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey,
    authHeader:
      env.AI_GATEWAY_AUTH_HEADER?.trim() || (customKey ? "Authorization" : "Lovable-API-Key"),
    model: env.AI_MODEL?.trim() || "google/gemini-3-flash-preview",
    provider: env.AI_PROVIDER?.trim() || (customKey ? "custom" : "lovable"),
  };
}

export function sanitizeMessages(value: unknown): AiMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(-24)
    .filter((item): item is { role: AiRole; content: unknown } => {
      if (!item || typeof item !== "object") return false;
      const role = (item as { role?: unknown }).role;
      return role === "user" || role === "assistant" || role === "system";
    })
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? "")
        .trim()
        .slice(0, 8_000),
    }))
    .filter((item) => item.content.length > 0);
}

export async function completeAiChat(input: {
  messages: AiMessage[];
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
}): Promise<{ content: string; model: string; provider: string }> {
  const config = getAiGatewayConfig();
  if (!config) throw new AiGatewayError("AI is not configured", 503, "not_configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set(
      config.authHeader,
      config.authHeader.toLowerCase() === "authorization"
        ? `Bearer ${config.apiKey}`
        : config.apiKey,
    );
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: input.messages,
        ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      }),
    });
    if (!response.ok) {
      await response.text();
      if (response.status === 429)
        throw new AiGatewayError("AI is temporarily busy", 429, "rate_limited");
      if (response.status === 402)
        throw new AiGatewayError("AI credits are unavailable", 503, "credits_exhausted");
      throw new AiGatewayError("AI provider request failed", 502, "upstream");
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content)
      throw new AiGatewayError("AI provider returned an empty response", 502, "upstream");
    return { content, model: config.model, provider: config.provider };
  } catch (error) {
    if (error instanceof AiGatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new AiGatewayError("AI request timed out", 504, "timeout");
    throw new AiGatewayError("AI provider could not be reached", 502, "upstream");
  } finally {
    clearTimeout(timer);
  }
}
