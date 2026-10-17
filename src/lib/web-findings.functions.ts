import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WebFinding = {
  topic: string;
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
};

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

const QUERY: Record<string, string> = {
  "Legal status": "land zoning planning regulations",
  "Investment return": "land prices per acre",
  "Market depth": "land for sale listings",
  Utilities: "electricity water supply Kenya Power",
  Safety: "security crime police",
  Community: "residents community amenities",
  "Planned development": "road project development plan CIDP",
};

/**
 * Public web search for topics HALISIA has no structured data for.
 * Returns only results that actually came back, each with its source link.
 * A topic with no result is omitted — never padded.
 */
export const getWebFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        place: z.string().trim().min(2).max(120),
        topics: z.array(z.string().max(60)).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<WebFinding[]> => {
    const lov = process.env.LOVABLE_API_KEY;
    const fc = process.env.FIRECRAWL_API_KEY;
    if (!lov || !fc) return [];
    const run = async (topic: string): Promise<WebFinding | null> => {
      const q = `${data.place} ${QUERY[topic] ?? topic}`;
      try {
        const res = await fetch(`${GATEWAY}/search`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lov}`,
            "X-Connection-Api-Key": fc,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: q, limit: 3, country: "KE" }),
        });
        if (!res.ok) {
          console.error(`web finding ${topic} [${res.status}]: ${await res.text()}`);
          return null;
        }
        const j = (await res.json()) as {
          data?:
            | { web?: Array<{ url?: string; title?: string; description?: string }> }
            | Array<{ url?: string; title?: string; description?: string }>;
        };
        const list = Array.isArray(j.data) ? j.data : (j.data?.web ?? []);
        const hit = list.find((r) => r.url && r.description && r.description.length > 30);
        if (!hit) return null;
        return {
          topic,
          summary: hit.description!.trim().slice(0, 240),
          sourceTitle: (hit.title ?? new URL(hit.url!).hostname).slice(0, 120),
          sourceUrl: hit.url!,
          retrievedAt: new Date().toISOString(),
        };
      } catch (e) {
        console.error("web finding failed", topic, e);
        return null;
      }
    };
    const out: WebFinding[] = [];
    for (let i = 0; i < data.topics.length; i += 6) {
      const chunk = await Promise.all(data.topics.slice(i, i + 6).map(run));
      for (const f of chunk) if (f) out.push(f);
    }
    return out;
  });
