import { supabase } from "@/integrations/supabase/client";

export type SavedKind = "location" | "county" | "property" | "match" | "report";

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

// ---------------------------------------------------------------------------
// Saved reports
// ---------------------------------------------------------------------------

export type SavedReport = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  ref: string;
  note: string | null;
  is_favorite: boolean;
  created_at: string;
};

/** Stable key for a report: rounded coordinates keep repeat saves idempotent. */
export function reportRef(lat: number, lng: number, deedRef?: string) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}${deedRef ? `|${deedRef}` : ""}`;
}

function toReport(item: SavedItem): SavedReport {
  const [coords, deed] = item.ref.split("|");
  const [la, ln] = (coords ?? "").split(",");
  return {
    id: item.id,
    label: item.label,
    lat: item.latitude ?? (Number(la) || 0),
    lng: item.longitude ?? (Number(ln) || 0),
    ref: deed ?? "",
    note: item.note,
    is_favorite: item.is_favorite,
    created_at: item.created_at,
  };
}

export async function listSavedReports(): Promise<SavedReport[]> {
  const { data, error } = await supabase
    .from("saved_items")
    .select("*")
    .eq("kind", "report")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SavedItem[]).map(toReport);
}

export async function saveReport(input: {
  lat: number;
  lng: number;
  label: string;
  deedRef?: string;
  note?: string | null;
}) {
  return saveItem({
    kind: "report",
    ref: reportRef(input.lat, input.lng, input.deedRef),
    label: input.label || `${input.lat.toFixed(4)}, ${input.lng.toFixed(4)}`,
    latitude: input.lat,
    longitude: input.lng,
    note: input.note ?? null,
  });
}

export async function updateSavedNote(id: string, note: string) {
  const { error } = await supabase
    .from("saved_items")
    .update({ note: note.trim() || null })
    .eq("id", id);
  if (error) throw error;
}
