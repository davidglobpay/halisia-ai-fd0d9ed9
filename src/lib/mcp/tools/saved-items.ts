import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_items",
  title: "List my saved places",
  description: "List the signed-in user's saved places, parcels and searches in HALISIA.",
  inputSchema: { limit: z.number().int().min(1).max(50).default(20) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("saved_items")
      .select("id,kind,label,ref,note,is_favorite,created_at")
      .eq("user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new ToolError(error.message);
    const items = (data ?? []).map((i) => ({ ...i }));
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});
