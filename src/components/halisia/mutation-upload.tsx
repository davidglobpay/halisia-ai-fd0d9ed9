import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Ruler, X } from "lucide-react";
import { extractPdfText } from "@/lib/pdf-text";
import {
  parseMutationPlan,
  checkDeedAgainstPlan,
  type MutationPlan,
  type DeedPlanAgreement,
} from "@/lib/mutation-plan";
import { describeArea } from "@/lib/parcel-geometry";
import { ReadAloud } from "@/components/halisia/read-aloud";

/**
 * Read a surveyor's mutation plan and check it against the deed.
 *
 * The plan carries the plot sizes, the scale and the adjoining parcels as
 * text, so this reads them rather than asking a buyer to measure a drawing.
 * Two things it surfaces above everything else:
 *
 * 1. Whether the sheet calls itself provisional. On a real Konza sheet the
 *    line reads "The plan is provision and subjevt to final ground survey" —
 *    misspelled, buried under the drawing, and the single most important
 *    sentence on the page. It means the beacons are not fixed.
 *
 * 2. Whether the deed and the plan actually describe the same land. They
 *    overlap on the block, the registry map sheet number and the area, and a
 *    plan shown beside a deed it does not belong to is the commonest way a
 *    buyer is walked onto the wrong plot.
 *
 * Neither check makes a title genuine. Two documents forged together agree
 * perfectly, and this says so rather than implying otherwise.
 */

export function MutationUpload({
  deed,
  className = "",
}: {
  /** Fields already read from the title deed, for the cross-check. */
  deed?: { sheet?: string | null; areaText?: string | null; block?: string | null };
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<MutationPlan | null>(null);
  const [agreement, setAgreement] = useState<DeedPlanAgreement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handle = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      setError(null);
      setPlan(null);
      setAgreement(null);
      setFileName(file.name);
      try {
        const res = await extractPdfText(file);
        if (!res.ok) {
          setError(res.reason);
          return;
        }
        const parsed = parseMutationPlan(res.items);
        if (!parsed.plots.length && !parsed.dimensionsM.length) {
          setError(
            "No plot sizes or dimensions were found on that sheet. It may be a different kind of drawing.",
          );
          return;
        }
        setPlan(parsed);
        if (deed && (deed.sheet || deed.areaText || deed.block)) {
          setAgreement(checkDeedAgainstPlan(deed, parsed));
        }
      } catch (e) {
        console.error(e);
        setError("That file could not be read.");
      } finally {
        setBusy(false);
      }
    },
    [deed],
  );

  const spoken = plan
    ? [
        `Mutation plan read.`,
        plan.block ? `Block ${plan.block}.` : "",
        plan.sheet ? `Registry map sheet ${plan.sheet}.` : "",
        plan.scale ? `Drawn at a scale of one to ${plan.scale.ratio}.` : "",
        plan.plots.length ? `${plan.plots.length} plots on this sheet.` : "",
        plan.provisional
          ? "Important. This plan states that it is provisional and subject to final ground survey. " +
            "That means the beacons are not fixed and these plot numbers are not registered titles yet."
          : "",
        agreement
          ? agreement.conflicts.length
            ? `The deed and this plan disagree on ${agreement.conflicts.join(" and ")}. Stop and ask why.`
            : `The deed and this plan agree on all ${agreement.total} checks.`
          : "",
        "This reads the sheet. It does not confirm a boundary, and it does not confirm ownership.",
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className={`rounded-2xl glass border border-white/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Step 2 · The mutation plan
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">
            Read the surveyor&rsquo;s plan
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload the mutation PDF the surveyor produced. Plot sizes, dimensions and the scale are
            read from the sheet itself.
          </p>
        </div>
        {plan && <ReadAloud text={spoken} label="Listen" />}
      </div>

      <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
        ) : (
          <FileUp className="h-4 w-4 text-accent" aria-hidden="true" />
        )}
        {busy ? "Reading the sheet…" : fileName ? "Choose a different plan" : "Choose the mutation PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void handle(e.target.files?.[0] ?? null)}
        />
      </label>

      {fileName && !busy && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{fileName}</p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-amber-glow/30 bg-amber-glow/5 p-3 text-xs text-amber-glow"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {plan && (
        <div className="mt-3 space-y-3">
          {/* The provisional warning outranks everything else on the sheet. */}
          {plan.provisional && (
            <div
              role="alert"
              data-testid="plan-provisional"
              className="rounded-xl border-l-4 border-destructive bg-destructive/5 p-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-destructive">
                This plan is provisional
              </div>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                The sheet states it is subject to a final ground survey. The beacons are not fixed
                and these plot numbers are not registered titles. What is drawn here is an
                intention, not a parcel.
              </p>
              {plan.provisionalNote && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  As printed: &ldquo;{plan.provisionalNote}&rdquo;
                </p>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {plan.block && (
              <>
                <dt className="text-muted-foreground">Block</dt>
                <dd className="truncate font-medium">{plan.block}</dd>
              </>
            )}
            {plan.sheet && (
              <>
                <dt className="text-muted-foreground">Registry map sheet</dt>
                <dd className="font-medium">{plan.sheet}</dd>
              </>
            )}
            {plan.scale && (
              <>
                <dt className="text-muted-foreground">Scale</dt>
                <dd className="font-medium">
                  1:{plan.scale.ratio}
                  <span className="ml-1 text-muted-foreground">
                    (1 mm = {plan.scale.metresPerMm} m)
                  </span>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Plots on this sheet</dt>
            <dd className="font-medium">{plan.plots.length}</dd>
          </dl>

          {plan.plots.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Plot sizes printed on the sheet
              </div>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {[...new Set(plan.plots.map((p) => p.areaM2))]
                  .sort((a, b) => a - b)
                  .map((a) => (
                    <li
                      key={a}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]"
                    >
                      {describeArea(a)}
                      <span className="ml-1 text-muted-foreground">
                        ×{plan.plots.filter((p) => p.areaM2 === a).length}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {plan.dimensionsM.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <Ruler className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Dimensions {plan.metricDimensions ? "(metres, as the sheet states)" : ""}
              </div>
              <p className="mt-1 font-mono text-[11px] text-foreground/85">
                {plan.dimensionsM.join(" · ")}
              </p>
            </div>
          )}

          {plan.neighbours.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Adjoining parcels
              </div>
              <p className="mt-1 font-mono text-[11px] text-foreground/85">
                {plan.neighbours.join(" · ")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ask the seller to walk you to a boundary these numbers share. A neighbour who does
                not recognise the plot is the cheapest check there is.
              </p>
            </div>
          )}

          {agreement && agreement.total > 0 && (
            <div
              data-testid="deed-plan-agreement"
              className={`rounded-xl border p-3 ${
                agreement.conflicts.length
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest">
                {agreement.conflicts.length ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden="true" />
                    <span className="text-destructive">
                      Deed and plan disagree ({agreement.agreed}/{agreement.total})
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden="true" />
                    <span className="text-primary">
                      Deed and plan agree ({agreement.agreed}/{agreement.total})
                    </span>
                  </>
                )}
              </div>
              <ul className="mt-1.5 space-y-1 text-[11px]">
                {agreement.checks.map((c) => (
                  <li key={c.name} className="flex items-start gap-1.5">
                    {c.agrees ? (
                      <CheckCircle2
                        className="mt-0.5 h-3 w-3 flex-none text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <X className="mt-0.5 h-3 w-3 flex-none text-destructive" aria-hidden="true" />
                    )}
                    <span>
                      <span className="font-medium">{c.name}:</span>{" "}
                      <span className="text-muted-foreground">
                        deed “{c.deed}” vs plan “{c.plan}”
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Agreement does not make a title genuine — two documents prepared together will
                always agree. What it rules out is a plan being shown beside a deed it does not
                belong to.
              </p>
            </div>
          )}

          <p className="border-t border-white/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Read from the sheet you uploaded. HALISIA does not survey land, does not confirm a
            boundary, and reads nothing about ownership from this document. A licensed surveyor
            fixes beacons; an advocate confirms title.
          </p>
        </div>
      )}
    </div>
  );
}
