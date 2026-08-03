import { supabase } from "@/integrations/supabase/client";

export type SavedKind = "location" | "county" | "property" | "match";

export type SavedItem = {
  id: string;
  user_id: string;
  kind: SavedKind;
  ref: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export async function listSavedItems(): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from("saved_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedItem[];
}

export async function saveItem(input: {
  kind: SavedKind;
  ref: string;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  is_favorite?: boolean;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error("Sign in to save items");
  const { data, error } = await supabase
    .from("saved_items")
    .upsert(
      {
        user_id: user.id,
        kind: input.kind,
        ref: input.ref,
        label: input.label,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        note: input.note ?? null,
        is_favorite: input.is_favorite ?? false,
      },
      { onConflict: "user_id,kind,ref" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as SavedItem;
}

export async function removeSavedItem(id: string) {
  const { error } = await supabase.from("saved_items").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(id: string, is_favorite: boolean) {
  const { error } = await supabase.from("saved_items").update({ is_favorite }).eq("id", id);
  if (error) throw error;
}

export async function isSaved(kind: SavedKind, ref: string): Promise<SavedItem | null> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data, error } = await supabase
    .from("saved_items")
    .select("*")
    .eq("kind", kind)
    .eq("ref", ref)
    .maybeSingle();
  if (error) return null;
  return (data as SavedItem) ?? null;
}
