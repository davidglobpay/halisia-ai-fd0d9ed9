import { createServerFn } from "@tanstack/react-start";

export type ResourceFlagStatus = {
  key: string;
  enabled: boolean;
  description: string | null;
};

export type ResourceFoundationStatus = {
  ok: boolean;
  flags: ResourceFlagStatus[];
  counts: {
    sources: number;
    observations: number;
    assessments: number;
    evidenceLinks: number;
  };
  error?: string;
};

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:sb_[a-z]+_|eyJ)[A-Za-z0-9._-]+/g, "[redacted]").slice(0, 160);
}

/**
 * Read-only foundation status for the Resource Intelligence UI.
 * Uses the server-only service role client because the M0-A tables are
 * intentionally not client-readable while the evidence model is being proven.
 */
export const getResourceFoundationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceFoundationStatus> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Generated Database types intentionally lag additive migrations. Keep the
      // cast local to this server-only adapter instead of weakening app-wide typing.
      const db = supabaseAdmin as unknown as {
        from: (table: string) => {
          select: (
            columns: string,
            options?: { count?: "exact"; head?: boolean },
          ) => Promise<{ data: unknown; count: number | null; error: { message: string } | null }>;
        };
      };

      const [flagsR, sourcesR, observationsR, assessmentsR, linksR] = await Promise.all([
        db.from("resource_feature_flags").select("key,enabled,description"),
        db.from("resource_sources").select("id", { count: "exact", head: true }),
        db.from("resource_observations").select("id", { count: "exact", head: true }),
        db.from("resource_assessments").select("id", { count: "exact", head: true }),
        db.from("resource_evidence_links").select("id", { count: "exact", head: true }),
      ]);

      const firstError = [flagsR, sourcesR, observationsR, assessmentsR, linksR].find(
        (result) => result.error,
      )?.error;
      if (firstError) throw new Error(firstError.message);

      const flags = Array.isArray(flagsR.data)
        ? (flagsR.data as ResourceFlagStatus[]).sort((a, b) => a.key.localeCompare(b.key))
        : [];

      return {
        ok: true,
        flags,
        counts: {
          sources: sourcesR.count ?? 0,
          observations: observationsR.count ?? 0,
          assessments: assessmentsR.count ?? 0,
          evidenceLinks: linksR.count ?? 0,
        },
      };
    } catch (error) {
      return {
        ok: false,
        flags: [],
        counts: { sources: 0, observations: 0, assessments: 0, evidenceLinks: 0 },
        error: safeError(error),
      };
    }
  },
);
