import { useQuery } from "@tanstack/react-query";
import { landScopeLabel } from "@/lib/cost-intel";
import { getLandPriceSummary } from "@/lib/cost-intel.functions";
import { kes } from "@/lib/cost-intel";
import { Surface } from "@/components/halisia/ds";

/**
 * Observed land prices near a location. Every figure is computed from
 * database observations; with fewer than 5 observations in scope the panel
 * says "Not enough priced data yet" and shows no number.
 */
export function LandPricePanel(props: { county: string; subCounty?: string; ward?: string }) {
  const q = useQuery({
    queryKey: ["land-price", props.county, props.subCounty, props.ward],
    queryFn: () =>
      getLandPriceSummary({
        data: { county: props.county, subCounty: props.subCounty, ward: props.ward },
      }),
    enabled: !!props.county,
    staleTime: 10 * 60_000,
  });

  return (
    <Surface elevation={1} className="p-4" data-testid="land-price-panel">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Observed land prices
      </p>
      {q.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading observations…</p>
      ) : q.isError ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Price observations could not be loaded. This is a data gap, not evidence about value.
        </p>
      ) : !q.data ? (
        <p className="mt-2 text-sm" data-testid="land-price-insufficient">
          Not enough priced data yet
        </p>
      ) : (
        <>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {q.data.observations} observations in the last 12 months ({landScopeLabel(q.data.scope)}{" "}
            scope) · newest {q.data.newestDate} · sources: {q.data.sourceTypes.join(", ")}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.bands.map((b) => (
              <div
                key={b.plot.key}
                className="rounded-lg border border-white/10 bg-black/10 p-3"
                data-testid={`land-price-${b.plot.key}`}
              >
                <p className="text-xs font-medium">{b.plot.label}</p>
                <p className="mt-1 font-mono text-sm">{kes(b.median)}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {kes(b.low)} – {kes(b.high)}
                </p>
              </div>
            ))}
          </div>
          {q.data.indexMedianPerSqft != null && (
            <p className="mt-2 text-[11px]" data-testid="land-price-index">
              Market index (cross-check): {kes(q.data.indexMedianPerSqft)} / sqft median across{" "}
              {q.data.indexObservations} index observations — not part of the median above.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Market estimate, not a valuation. Median of observed asking/reported prices per square
            foot, expanded to standard plot sizes.
          </p>
        </>
      )}
    </Surface>
  );
}
