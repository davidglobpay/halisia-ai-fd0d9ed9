import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "user" | "assistant" | "system"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ reply: "AI is not configured yet." }, { status: 500 });

        const { messages = [], context } = (await request.json()) as {
          messages?: Msg[];
          context?: string;
        };

        const system: Msg = {
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
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [system, ...messages],
            }),
          });
          if (!res.ok) {
            const body = await res.text();
            console.error("AI gateway error", res.status, body);
            if (res.status === 429)
              return Response.json({
                reply: "I'm getting a lot of questions right now — please try again in a moment.",
              });
            if (res.status === 402)
              return Response.json({
                reply: "AI credits are exhausted. Please top up in Settings → Plans & credits.",
              });
            return Response.json({ reply: "I hit a snag reaching my model. Try again shortly." });
          }
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const reply = data?.choices?.[0]?.message?.content ?? "I couldn't form a reply.";
          return Response.json({ reply });
        } catch (err) {
          console.error(err);
          return Response.json({ reply: "Network hiccup on my side. Try again." });
        }
      },
    },
  },
});
