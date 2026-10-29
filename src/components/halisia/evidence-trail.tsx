import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { fetchEvidenceTrail } from "@/lib/projects";
import { TIER_LABEL } from "@/lib/evidence-observation";
import { formatDate } from "@/lib/format-datetime";

/**
 * "Why HALISIA says this": the recorded readings behind a place, with their
 * source, method and how long HALISIA has been keeping them. Reads only what
 * row-level security allows: public-place readings when signed in, parcel
 * readings for the parcel's owner.
 */
export function EvidenceTrail({
  locationKey,
  className = "",
}: {
  locationKey: string | null | undefined;
  className?: string;
}) {
  const q = useQuery({
    queryKey: ["evidence-trail", locationKey],
    queryFn: () => fetchEvidenceTrail(locationKey as string),
    enabled: Boolean(locationKey),
    staleTime: 60_000,
  });

  return (
    <section
      aria-labelledby="evidence-trail-title"
      data-testid="evidence-trail"
      className={`glass rounded-2xl border border-white/10 p-4 ${className}`}
    >
      <h2 id="evidence-trail-title" className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-accent" aria-hidden="true" /> Why HALISIA says this
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The recorded readings behind this place: where each came from, how it was obtained and when.
        Readings are kept, not overwritten, so changes over time stay visible.
      </p>

      {!locationKey ? (
        <p className="mt-3 text-sm text-muted-foreground">Choose a place to see its evidence.</p>
      ) : q.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading evidence…
        </p>
      ) : q.isError ? (
        <p role="alert" className="mt-3 text-sm text-amber-glow">
          The evidence record could not be loaded. Nothing here means the place lacks evidence.
        </p>
      ) : !q.data?.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No readings recorded here yet. HALISIA starts keeping history the first time this place is
          analysed while you are signed in.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/10">
          {q.data.map((row) => (
            <li key={row.indicator} className="py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">
                  Latest {formatDate(row.latestAt)}
                  {row.readings > 1
                    ? ` · ${row.readings} readings since ${formatDate(row.firstAt)}`
                    : " · 1 reading"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.source ? (
                  <>
                    Source:{" "}
                    {row.source.url ? (
                      <a
                        href={row.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {row.source.authority}
                      </a>
                    ) : (
                      row.source.authority
                    )}
                    {row.source.licence ? ` (${row.source.licence})` : ""}
                  </>
                ) : (
                  "Source not recorded"
                )}
                {" · "}
                {TIER_LABEL[row.tier] ?? row.tier}
                {" · method "}
                <code className="text-[11px]">{row.method}</code>
                {row.degraded ? " · latest reading was partial" : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
