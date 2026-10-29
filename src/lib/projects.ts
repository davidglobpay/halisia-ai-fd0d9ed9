/**
 * Projects: one record per site that links everything HALISIA knows or
 * produces about it — the place, saved reports, listings, financing, bids and
 * the evidence behind them. Row-level security decides who sees what: owners
 * and members see the project; each linked record still follows its own rules.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { summariseTrail, type EvidenceTrailRow } from "@/lib/evidence-observation";

// PR #35's additive schema contract, kept local while its migration is pending.
// This supplies types only: the existing client, authentication and RLS are unchanged.
export type Project = {
  id: string;
  owner_id: string;
  name: string;
  stage: string;
  latitude: number | null;
  longitude: number | null;
  location_key: string | null;
  county: string | null;
  parcel_id: string | null;
  property_id: string | null;
  boundary: Json | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type LinkedTable = "parcels" | "properties" | "financing_applications" | "saved_items" | "bid_requests";
type ExistingTables = Database["public"]["Tables"];
type ProjectTables = {
  [K in keyof ExistingTables]: K extends LinkedTable
    ? Omit<ExistingTables[K], "Row" | "Insert" | "Update"> & {
        Row: ExistingTables[K]["Row"] & { project_id: string | null };
        Insert: ExistingTables[K]["Insert"] & { project_id?: string | null };
        Update: ExistingTables[K]["Update"] & { project_id?: string | null };
      }
    : ExistingTables[K];
} & {
  projects: {
    Row: Project;
    Insert: Partial<Project> & Pick<Project, "name">;
    Update: Partial<Project>;
    Relationships: [];
  };
};
type ProjectDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & { Tables: ProjectTables };
};
const projectClient = supabase as unknown as SupabaseClient<ProjectDatabase>;

export {
  PROJECT_STAGES,
  stageLabel,
  areaKey,
  validProjectName,
  validCoordinate,
  type ProjectStage,
} from "@/lib/project-core";
import { areaKey, validCoordinate, validProjectName } from "@/lib/project-core";

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await projectClient
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await projectClient.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(input: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  county?: string | null;
}): Promise<Project> {
  const problem = validProjectName(input.name);
  if (problem) throw new Error(problem);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to create a project.");
  const coord = validCoordinate(input.lat, input.lng);
  const { data, error } = await projectClient
    .from("projects")
    .insert({
      owner_id: auth.user.id,
      name: input.name.trim(),
      latitude: coord?.lat ?? null,
      longitude: coord?.lng ?? null,
      location_key: coord ? areaKey(coord.lat, coord.lng) : null,
      county: input.county?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "stage" | "notes" | "county">>,
): Promise<void> {
  if (patch.name !== undefined) {
    const problem = validProjectName(patch.name);
    if (problem) throw new Error(problem);
  }
  const { error } = await projectClient.from("projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await projectClient.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export type ProjectLinks = {
  saved: Array<{ id: string; label: string; kind: string; ref: string }>;
  listings: Array<{ id: string; title: string; status: string }>;
  financing: Array<{ id: string; borrower_name: string; status: string; requested_amount: number }>;
  bids: Array<{ id: string; title: string; status: string }>;
};

/** Everything linked to a project that the viewer is allowed to see. */
export async function listProjectLinks(projectId: string): Promise<ProjectLinks> {
  const [saved, listings, financing, bids] = await Promise.all([
    projectClient.from("saved_items").select("id,label,kind,ref").eq("project_id", projectId),
    projectClient.from("properties").select("id,title,status").eq("project_id", projectId),
    projectClient
      .from("financing_applications")
      .select("id,borrower_name,status,requested_amount")
      .eq("project_id", projectId),
    projectClient.from("bid_requests").select("id,title,status").eq("project_id", projectId),
  ]);
  return {
    saved: (saved.data ?? []) as ProjectLinks["saved"],
    listings: (listings.data ?? []).map((r) => ({ ...r, status: String(r.status) })),
    financing: (financing.data ?? []).map((r) => ({
      ...r,
      status: String(r.status),
      requested_amount: Number(r.requested_amount),
    })),
    bids: (bids.data ?? []).map((r) => ({ ...r, status: String(r.status) })),
  };
}

/** The signed-in user's saved items that are not yet on this project. */
export async function listLinkableSavedItems(projectId: string) {
  const { data, error } = await projectClient
    .from("saved_items")
    .select("id,label,kind,project_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).filter((r) => r.project_id !== projectId);
}

/** Attach or detach a saved item. The database refuses projects you can't edit. */
export async function setSavedItemProject(itemId: string, projectId: string | null) {
  const { error } = await projectClient
    .from("saved_items")
    .update({ project_id: projectId })
    .eq("id", itemId);
  if (error) throw error;
}

/** Recorded readings for a place, grouped per dataset, newest first. */
export async function fetchEvidenceTrail(locationKey: string): Promise<EvidenceTrailRow[]> {
  const { data, error } = await supabase
    .from("resource_observations")
    .select(
      "indicator, retrieved_at, methodology, epistemic_tier, verification_state, metadata, resource_sources(authority, source_url, licence)",
    )
    .eq("subject_ref", locationKey)
    .order("retrieved_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return summariseTrail((data ?? []) as unknown as Parameters<typeof summariseTrail>[0]);
}
