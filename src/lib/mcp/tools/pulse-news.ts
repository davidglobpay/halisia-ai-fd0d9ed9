import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_pulse_news",
  title: "Get Pulse land news",
  description: "List recent HALISIA Pulse land and property news, optionally filtered by county.",
  inputSchema: {
    county: z.string().trim().max(60).optional().describe("Kenyan county name."),
    limit: z.number().int().min(1).max(20).default(8),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ county, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("news_articles")
      .select("id,title,summary,county,category,source_name,published_at")
      .eq("archived", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (county) q = q.ilike("county", county);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const articles = (data ?? []).map((a) => ({ ...a }));
    return {
      content: [{ type: "text", text: JSON.stringify(articles) }],
      structuredContent: { articles },
    };
  },
});
