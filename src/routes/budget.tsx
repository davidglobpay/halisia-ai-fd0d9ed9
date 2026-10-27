import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  FINISHES,
  STRUCTURES,
  TYPOLOGIES,
  getBudgetOptions,
  getBuildCost,
} from "@/lib/cost-intel.functions";
import { PLOT_SIZES, budgetBuildFigure, kes } from "@/lib/cost-intel";
import { Surface, SectionHeading } from "@/components/halisia/ds";
import { KENYA_COUNTY_FACTS } from "@/lib/kenya-county-facts";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Budget planner — HALISIA" },
      {
        name: "description",
        content:
          "Rank wards where observed median land plus a priced build cost fit your budget. Deterministic computation only — no AI-generated prices.",
      },
      { property: "og:title", content: "Budget planner — HALISIA" },
      {
        property: "og:description",
        content:
          "Ward ranking from observed land prices and priced BoQs; unpriced data is never estimated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetPage,
});

const label = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function BudgetPage() {
  const [budget, setBudget] = useState<number>(3_000_000);
  const [county, setCounty] = useState<string>("Kajiado");
  const [plotSqft, setPlotSqft] = useState<number>(PLOT_SIZES[0].sqft);
  const [typology, setTypology] = useState<string>("2br");
  const [structure, setStructure] = useState<string>("masonry_stone");
  const [finish, setFinish] = useState<string>("standard");

  const buildQ = useQuery({
    queryKey: ["budget-build", typology, structure, finish, county],
    queryFn: () => getBuildCost({ data: { typology, structure, finish, county } }),
  });
  const buildTotal = buildQ.data ? budgetBuildFigure(buildQ.data.costing) : null;

  const optionsQ = useQuery({
    queryKey: ["budget-options", county, budget, plotSqft, buildTotal],
    queryFn: () =>
      getBudgetOptions({ data: { county, budget, plotSqft, buildTotal: buildTotal! } }),
    enabled: buildTotal != null,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6" data-testid="budget-page">
      <SectionHeading
        eyebrow="Cost intelligence"
        title="Budget planner"
        description="Wards where the observed median land price plus a priced build cost fit your budget. Ranking is deterministic; no AI-generated prices."
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-xs">
          Budget (KES)
          <input
            type="number"
            min={0}
            step={100000}
            className="ml-2 min-h-11 w-36 rounded-lg border border-white/15 bg-background px-2"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            data-testid="bp-budget"
          />
        </label>
        <label className="text-xs">
          County
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            data-testid="bp-county"
          >
            {Object.values(KENYA_COUNTY_FACTS).map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Plot size
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={plotSqft}
            onChange={(e) => setPlotSqft(Number(e.target.value))}
            data-testid="bp-plot"
          >
            {PLOT_SIZES.map((p) => (
              <option key={p.key} value={p.sqft}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Typology
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={typology}
            onChange={(e) => setTypology(e.target.value)}
          >
            {TYPOLOGIES.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Structure
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={structure}
            onChange={(e) => setStructure(e.target.value)}
          >
            {STRUCTURES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Finish
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={finish}
            onChange={(e) => setFinish(e.target.value)}
          >
            {FINISHES.map((f) => (
              <option key={f} value={f}>
                {label(f)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Surface elevation={1} className="mt-4 p-4">
        {buildQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Computing build cost…</p>
        ) : buildTotal == null ? (
          <p className="text-sm" data-testid="bp-no-build">
            Not enough priced data yet — the build cost for this combination is less than 90%
            priced, so no ward ranking is shown.
          </p>
        ) : optionsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Ranking wards…</p>
        ) : !optionsQ.data?.length ? (
          <p className="text-sm" data-testid="bp-empty">
            Not enough priced data yet — no ward in {county} has at least 5 recent land observations
            within budget.
          </p>
        ) : (
          <table className="w-full text-xs" data-testid="bp-results">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Ward</th>
                <th className="py-1">Median land</th>
                <th className="py-1">Build (upper)</th>
                <th className="py-1">Combined</th>
                <th className="py-1">Margin left</th>
                <th className="py-1">n</th>
              </tr>
            </thead>
            <tbody>
              {optionsQ.data.map((o) => (
                <tr key={`${o.county}-${o.ward}`}>
                  <td className="py-1">
                    {o.ward}
                    {o.sub_county ? `, ${o.sub_county}` : ""}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({o.scope === "ward" ? "ward median" : "sub-county median"})
                    </span>
                  </td>
                  <td className="py-1 font-mono">{kes(o.landMedian)}</td>
                  <td className="py-1 font-mono">{kes(o.buildTotal)}</td>
                  <td className="py-1 font-mono">{kes(o.combined)}</td>
                  <td className="py-1 font-mono">{kes(o.margin)}</td>
                  <td className="py-1 font-mono">{o.landObservations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Market estimate, not a valuation. Land figures are medians of observed prices over the last
        12 months; wards with fewer than 5 observations fall back to their sub-county median, and
        areas with fewer than 5 observations are excluded. Build uses the upper priced estimate.
      </p>
    </main>
  );
}
