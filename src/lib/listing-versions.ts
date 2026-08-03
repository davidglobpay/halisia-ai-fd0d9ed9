/**
 * Version history for listing edits.
 *
 * Each save snapshots the title, description and missing-information checklist
 * so an owner can see exactly what changed between resubmissions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { ChecklistItem } from "@/lib/listing-wizard";

export type ListingVersionRow = Database["public"]["Tables"]["listing_versions"]["Row"];

export type ChecklistSnapshot = { key: string; label: string; done: boolean };

export type VersionChange = {
  field: "title" | "description" | "checklist" | "completeness";
  label: string;
  before: string;
  after: string;
};

export type ListingVersion = {
  id: string;
  version: number;
  createdAt: string;
  title: string;
  description: string;
  completenessPct: number;
  checklist: ChecklistSnapshot[];
  changes: VersionChange[];
};

export function snapshotChecklist(items: ChecklistItem[]): ChecklistSnapshot[] {
  return items.map((i) => ({ key: i.key, label: i.label, done: i.done }));
}

function truncate(s: string, n = 220): string {
  const t = s.trim();
  if (!t) return "(empty)";
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Compare a previous snapshot against the incoming one. */
export function diffVersions(
  prev: Pick<ListingVersion, "title" | "description" | "completenessPct" | "checklist"> | null,
  next: Pick<ListingVersion, "title" | "description" | "completenessPct" | "checklist">,
): VersionChange[] {
  if (!prev) {
    return [
      {
        field: "title",
        label: "First tracked version",
        before: "—",
        after: truncate(next.title),
      },
    ];
  }
  const out: VersionChange[] = [];
  if (prev.title.trim() !== next.title.trim())
    out.push({
      field: "title",
      label: "Title updated",
      before: truncate(prev.title),
      after: truncate(next.title),
    });
  if (prev.description.trim() !== next.description.trim())
    out.push({
      field: "description",
      label: "Description updated",
      before: truncate(prev.description),
      after: truncate(next.description),
    });

  const prevMap = new Map(prev.checklist.map((c) => [c.key, c]));
  const resolved: string[] = [];
  const regressed: string[] = [];
  const added: string[] = [];
  for (const c of next.checklist) {
    const before = prevMap.get(c.key);
    if (!before) {
      if (!c.done) added.push(c.label);
      continue;
    }
    if (!before.done && c.done) resolved.push(c.label);
    if (before.done && !c.done) regressed.push(c.label);
  }
  if (resolved.length)
    out.push({
      field: "checklist",
      label: "Checklist items completed",
      before: `${resolved.length} outstanding`,
      after: resolved.join(", "),
    });
  if (regressed.length)
    out.push({
      field: "checklist",
      label: "Checklist items now missing",
      before: "Previously complete",
      after: regressed.join(", "),
    });
  if (added.length)
    out.push({
      field: "checklist",
      label: "New checklist items",
      before: "—",
      after: added.join(", "),
    });
  if (prev.completenessPct !== next.completenessPct)
    out.push({
      field: "completeness",
      label: "Completeness changed",
      before: `${prev.completenessPct}%`,
      after: `${next.completenessPct}%`,
    });

  if (out.length === 0)
    out.push({
      field: "title",
      label: "Resubmitted with no content changes",
      before: "—",
      after: "—",
    });
  return out;
}

function toVersion(r: ListingVersionRow): ListingVersion {
  return {
    id: r.id,
    version: r.version,
    createdAt: r.created_at,
    title: r.title,
    description: r.description ?? "",
    completenessPct: r.completeness_pct,
    checklist: Array.isArray(r.checklist) ? (r.checklist as unknown as ChecklistSnapshot[]) : [],
    changes: Array.isArray(r.changes) ? (r.changes as unknown as VersionChange[]) : [],
  };
}

export async function listVersions(propertyId: string): Promise<ListingVersion[]> {
  const { data, error } = await supabase
    .from("listing_versions")
    .select("*")
    .eq("property_id", propertyId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toVersion);
}

/** Records a new version, diffing against the most recent one. */
export async function recordVersion(input: {
  propertyId: string;
  title: string;
  description: string;
  completenessPct: number;
  checklist: ChecklistItem[];
}): Promise<ListingVersion | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const existing = await listVersions(input.propertyId).catch(() => [] as ListingVersion[]);
  const prev = existing[0] ?? null;
  const next = {
    title: input.title,
    description: input.description,
    completenessPct: input.completenessPct,
    checklist: snapshotChecklist(input.checklist),
  };
  const changes = diffVersions(prev, next);
  const { data, error } = await supabase
    .from("listing_versions")
    .insert({
      property_id: input.propertyId,
      editor_id: u.user.id,
      version: (prev?.version ?? 0) + 1,
      title: next.title,
      description: next.description || null,
      completeness_pct: next.completenessPct,
      checklist: next.checklist as unknown as Json,
      changes: changes as unknown as Json,
    })
    .select()
    .single();
  if (error) throw error;
  return toVersion(data);
}
