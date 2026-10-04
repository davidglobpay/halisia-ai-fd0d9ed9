import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_listings",
  title: "Search marketplace listings",
  description:
    "Search HALISIA marketplace listings visible to the signed-in user by county, text and max price. Listings are owner/source-listed, not title-verified.",
  inputSchema: {
    query: z.string().trim().max(120).optional().describe("Text to match in the listing title."),
    county: z.string().trim().max(60).optional().describe("Kenyan county name, e.g. Kiambu."),
    max_price: z.number().positive().optional().describe("Maximum asking price."),
    limit: z.number().int().min(1).max(25).default(10),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, county, max_price, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("properties")
      .select("id,title,county,kind,intent,price,currency,size_value,size_unit,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (query) q = q.ilike("title", `%${query}%`);
    if (county) q = q.ilike("county", county);
    if (max_price) q = q.lte("price", max_price);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const listings = (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      county: r.county,
      kind: String(r.kind),
      intent: String(r.intent),
      price: r.price,
      currency: r.currency,
      size: r.size_value,
      size_unit: r.size_unit,
      status: String(r.status),
      verification: "SOURCE_LISTED",
      updated_at: r.updated_at,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(listings) }],
      structuredContent: { listings },
    };
  },
});
