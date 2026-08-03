import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { listVersions, type ListingVersion } from "@/lib/listing-versions";

function ChangeRow({ c }: { c: ListingVersion["changes"][number] }) {
  return (
    <li className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="text-[11px] font-medium">{c.label}</div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2 text-[10px]">
        <div className="rounded border border-red-400/20 bg-red-500/5 p-1.5 text-red-200/90">
          <span className="uppercase tracking-widest text-[9px] text-muted-foreground">Before</span>
          <div className="mt-0.5 break-words">{c.before}</div>
        </div>
        <div className="rounded border border-emerald-400/20 bg-emerald-500/5 p-1.5 text-emerald-100/90">
          <span className="uppercase tracking-widest text-[9px] text-muted-foreground">After</span>
          <div className="mt-0.5 break-words">{c.after}</div>
        </div>
      </div>
    </li>
  );
}

/** Version history for a listing: what changed in title, description and checklist. */
export function VersionHistory({ propertyId }: { propertyId: string }) {
  const q = useQuery({
    queryKey: ["listing-versions", propertyId],
    queryFn: () => listVersions(propertyId),
  });

  return (
    <section
      data-testid="version-history"
      className="glass rounded-2xl border border-white/10 p-4"
      aria-label="Listing version history"
    >
      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <History className="h-3 w-3" aria-hidden="true" /> Version history
      </div>
      {q.isLoading && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading versions…
        </div>
      )}
      {q.error && (
        <p className="mt-2 text-[11px] text-red-300">{(q.error as Error).message}</p>
      )}
      {q.data && q.data.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No versions yet — the next time you save this listing a snapshot is recorded here.
        </p>
      )}
      <ol className="mt-2.5 grid gap-2.5">
        {(q.data ?? []).map((v) => (
          <li
            key={v.id}
            data-testid="version-entry"
            className="rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">Version {v.version}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(v.createdAt).toLocaleString("en-KE")} · completeness {v.completenessPct}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Checklist: {v.checklist.filter((c) => c.done).length}/{v.checklist.length} complete
              {v.checklist.some((c) => !c.done) && (
                <>
                  {" "}
                  · still missing:{" "}
                  <span className="text-amber-200">
                    {v.checklist
                      .filter((c) => !c.done)
                      .map((c) => c.label)
                      .join(", ")}
                  </span>
                </>
              )}
            </div>
            <ul className="mt-2 grid gap-1.5">
              {v.changes.map((c, i) => (
                <ChangeRow key={`${v.id}-${i}`} c={c} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
