import { supabase } from "@/integrations/supabase/client";

const BUCKET = "listing-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Uploads a listing photo and returns a long-lived shareable URL. */
export async function uploadListingPhoto(file: File): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error("Sign in to upload photos");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported");
  if (file.size > 8 * 1024 * 1024) throw new Error("Images must be under 8MB");

  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Could not create photo link");
  return data.signedUrl;
}
