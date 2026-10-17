import { createFileRoute } from "@tanstack/react-router";
import {
  AiGatewayError,
  completeAiChat,
  sanitizeMessages,
  type AiMessage,
} from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!token || !url || !key) {
          return Response.json({ reply: "Please sign in to use HALISIA AI." }, { status: 401 });
        }
        const { createClient } = await import("@supabase/supabase-js");
        const authClient = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return Response.json({ reply: "Please sign in to use HALISIA AI." }, { status: 401 });
        }
        let payload: { messages?: unknown; context?: unknown };
        try {
          payload = (await request.json()) as { messages?: unknown; context?: unknown };
        } catch {
          return Response.json({ reply: "The request body must be valid JSON." }, { status: 400 });
        }
        const messages = sanitizeMessages(payload.messages);
        const context =
          typeof payload.context === "string" ? payload.context.trim().slice(0, 4_000) : "";
        if (!messages.some((message) => message.role === "user")) {
          return Response.json(
            { reply: "Please include a question for HALISIA AI." },
            { status: 400 },
          );
        }

        const system: AiMessage = {
          role: "system",
          content: [
            "You are HALISIA AI, a land intelligence assistant for Kenya.",
            "You help users understand places before buying, building, or investing.",
            "Cover, when relevant: infrastructure, accessibility, environmental risk (especially flooding), utilities, security perception, community context, and investment signals.",
            "Explain your reasoning briefly. ALWAYS communicate uncertainty and confidence (Low / Medium / High).",
            "Never present outputs as legal truth. Recommend verification with surveyors/lawyers when relevant.",
            "Be calm, precise, and human. Prefer short paragraphs and light markdown (bold, bullets).",
            context ? `Current location context: ${context}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        };

        try {
          const result = await completeAiChat({ messages: [system, ...messages] });
          return Response.json({
            reply: result.content,
            model: result.model,
            provider: result.provider,
          });
        } catch (error) {
          if (error instanceof AiGatewayError) {
            const replies: Record<AiGatewayError["code"], string> = {
              not_configured: "AI is not configured yet.",
              rate_limited: "I'm getting a lot of questions right now — please try again shortly.",
              credits_exhausted: "AI service capacity is temporarily unavailable.",
              timeout: "The analysis took too long. Please try a shorter question.",
              upstream: "I couldn't reach the intelligence service. Please try again shortly.",
            };
            return Response.json(
              { reply: replies[error.code], code: error.code },
              { status: error.status },
            );
          }
          console.error("Unexpected HALISIA chat error", error);
          return Response.json(
            { reply: "HALISIA AI encountered an unexpected error." },
            { status: 500 },
          );
        }
      },
    },
  },
});
