import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";

const SYSTEM = `You write a short plain-English interpretation of land evidence for a Kenyan land intelligence product.
Rules:
- Use ONLY the evidence lines given. Every sentence must end with one or more citations like [elev] or [soil] using the ids in brackets.
- Items marked NOT AVAILABLE are gaps: say they are unknown, never guess them.
- Never claim or imply that title, ownership, boundary, area, survey or legal status is verified. Never predict prices or returns. Never say flood risk from elevation alone.
- 5 to 8 short bullet points starting with "- ", then one line starting "Biggest unknowns:".`;

export type PassportAiResult =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string };

export const summarisePassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ digest: z.string().min(20).max(12_000), place: z.string().max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<PassportAiResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, status: 401, message: "AI is not configured for this app." };
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
          include: ["reasoning.encrypted_content"],
          instructions: SYSTEM,
          input: `Place: ${data.place}\n\nEvidence:\n${data.digest}`,
        }),
      });
    } catch {
      return { ok: false, status: 502, message: "Could not reach the AI service." };
    }
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error(`Passport AI failed [${res.status}]: ${body.slice(0, 300)}`);
      const message =
        res.status === 429
          ? "AI is busy right now. Try again in a minute."
          : res.status === 402
            ? "AI credits are used up for this workspace."
            : res.status === 403
              ? "AI access was denied for this request."
              : `AI request failed (${res.status}).`;
      return { ok: false, status: res.status, message };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload) as { type?: string; delta?: string };
            if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
            if (ev.type === "response.refusal.delta") refused = true;
            if (ev.type === "response.failed" || ev.type === "error")
              return { ok: false, status: 502, message: "The AI service reported an error." };
          } catch {
            /* partial or non-JSON frame */
          }
        }
      }
    }
    if (refused) return { ok: false, status: 200, message: "The AI declined to summarise this." };
    if (!text.trim()) return { ok: false, status: 200, message: "The AI returned no text." };
    return { ok: true, text: text.trim() };
  });
