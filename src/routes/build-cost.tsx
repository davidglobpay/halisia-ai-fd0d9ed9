import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  FINISHES,
  STRUCTURES,
  TYPOLOGIES,
  getBuildCost,
} from "@/lib/cost-intel.functions";
import { kes } from "@/lib/cost-intel";
import { Surface, SectionHeading } from "@/components/halisia/ds";
import { KENYA_COUNTY_FACTS } from "@/lib/kenya-county-facts";

export const Route = createFileRoute("/build-cost")({
  head: () => ({
    meta: [
      { title: "Build cost calculator — HALISIA" },
      {
        name: "description",
        content:
          "Line-item bill of quantities costed from observed material and labour prices. Totals appear only when at least 90% of lines are priced.",
      },
      { property: "og:title", content: "Build cost calculator — HALISIA" },
      {
        property: "og:description",
        content: "BoQ costed from observed prices; unpriced lines stay visible, never estimated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildCostPage,
});

const label = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function BuildCostPage() {
  const [typology, setTypology] = useState<string>("2br");
  const [structure, setStructure] = useState<string>("masonry_stone");
  const [finish, setFinish] = useState<string>("standard");
  const [county, setCounty] = useState<string>("");
  const [floorArea, setFloorArea] = useState<number | null>(null);

  const costQ = useQuery({
    queryKey: ["build-cost", typology, structure, finish, county],
    queryFn: () => getBuildCost({ data: { typology, structure, finish, county: county || undefined } }),
  });
  const comparisonQ = useQuery({
    queryKey: ["build-cost-compare", typology, finish, county],
    queryFn: () =>
      Promise.all(
        STRUCTURES.map(async (s) => ({
          structure: s,
          result: await getBuildCost({
            data: { typology, structure: s, finish, county: county || undefined },
          }),
        })),
      ),
  });

  const effectiveArea = floorArea ?? costQ.data?.floorAreaM2 ?? null;
  const areaScale =
    floorArea && costQ.data?.floorAreaM2 ? floorArea / costQ.data.floorAreaM2 : 1;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6" data-testid="build-cost-page">
      <SectionHeading
        eyebrow="Cost intelligence"
        title="Build cost calculator"
        description="Line-item bill of quantities costed from observed material prices. Unpriced lines are greyed out, never estimated; no total is shown unless at least 90% of the BoQ is priced."
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-xs">
          Typology
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={typology}
            onChange={(e) => setTypology(e.target.value)}
            data-testid="bc-typology"
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
            data-testid="bc-structure"
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
            data-testid="bc-finish"
          >
            {FINISHES.map((f) => (
              <option key={f} value={f}>
                {label(f)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          County (pricing)
          <select
            className="ml-2 min-h-11 rounded-lg border border-white/15 bg-background px-2"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            data-testid="bc-county"
          >
            <option value="">National fallback</option>
            {KENYA_COUNTY_FACTS.map((c) => (
              <option key={c.code} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Floor area (m²)
          <input
            type="number"
            min={1}
            className="ml-2 min-h-11 w-24 rounded-lg border border-white/15 bg-background px-2"
            placeholder={costQ.data?.floorAreaM2 != null ? String(costQ.data.floorAreaM2) : "—"}
            onChange={(e) => setFloorArea(e.target.value ? Number(e.target.value) : null)}
            data-testid="bc-area"
          />
        </label>
      </div>

      <Surface elevation={1} className="mt-4 p-4">
        {costQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading BoQ…</p>
        ) : !costQ.data?.lines.length ? (
          <p className="text-sm" data-testid="bc-empty">
            Not enough priced data yet
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {costQ.data.costing.pricedLines} of {costQ.data.costing.totalLines} lines priced (
              {Math.round(costQ.data.costing.pricedShare * 100)}% of BoQ priced)
              {effectiveArea ? ` · floor area ${effectiveArea} m²` : ""}
            </p>
            <table className="mt-3 w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1">Item</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Unit price</th>
                  <th className="py-1">Line total</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {costQ.data.costing.lines.map((l) => (
                  <tr
                    key={l.item_code}
                    className={l.lineTotal == null ? "opacity-40" : undefined}
                    data-testid={`bc-line-${l.item_code}`}
                  >
                    <td className="py-1">{l.name ?? l.item_code}</td>
                    <td className="py-1 font-mono">
                      {l.quantity}
                      {l.unit ? ` ${l.unit}` : ""}
                    </td>
                    <td className="py-1 font-mono">
                      {l.price_kes != null ? kes(l.price_kes) : "not priced"}
                    </td>
                    <td className="py-1 font-mono">
                      {l.lineTotal != null ? kes(l.lineTotal * areaScale) : "—"}
                    </td>
                    <td className="py-1 text-muted-foreground">
                      {l.price_source
                        ? `${l.price_source === "national" ? "National" : "County"} · ${l.price_date}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {costQ.data.costing.total != null ? (
              <p className="mt-3 font-mono text-lg" data-testid="bc-total">
                Estimated total: {kes(costQ.data.costing.total * areaScale)}
              </p>
            ) : (
              <p className="mt-3 text-sm" data-testid="bc-no-total">
                No total shown — less than 90% of the BoQ is priced.
              </p>
            )}
          </>
        )}
      </Surface>

      <Surface elevation={1} className="mt-4 p-4">
        <h2 className="text-sm font-medium">Structure comparison (cheapest first)</h2>
        {comparisonQ.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">Comparing structures…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {(comparisonQ.data ?? [])
              .map((c) => ({ ...c, total: c.result.costing.total }))
              .sort((a, b) => (a.total ?? Number.MAX_SAFE_INTEGER) - (b.total ?? Number.MAX_SAFE_INTEGER))
              .map((c) => (
                <li key={c.structure} className="flex justify-between font-mono">
                  <span>{label(c.structure)}</span>
                  <span>
                    {c.total != null
                      ? kes(c.total)
                      : `${Math.round(c.result.costing.pricedShare * 100)}% priced — no total`}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Surface>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Market estimate, not a valuation or a contractor's quote. Computed only from observed
        prices in the cost database.
      </p>
    </main>
  );
}
