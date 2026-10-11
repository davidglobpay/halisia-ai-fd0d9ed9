import { CONSTRUCTION_MATERIALS, MARKET_SOURCES, countyMaterialPricing, formatMaterialPrice } from "@/lib/construction-market";

function MarketItem({ item }: { item: (typeof CONSTRUCTION_MATERIALS)[number] }) {
  return (
    <span className="inline-flex items-center gap-2 px-4 text-xs sm:text-sm">
      <span className="font-semibold text-foreground">{item.label}</span>
      <span className="text-accent">{formatMaterialPrice(item)}</span>
      <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-muted-foreground">
        {item.coverage === "quote-required" ? "QUOTE NEEDED" : "JAN 2026 · INDICATIVE"}
      </span>
    </span>
  );
}

/** An animated reference tape, deliberately not called a live price feed. */
export function ConstructionMarketTicker() {
  return (
    <aside aria-label="Kenya construction material price reference ticker" className="relative z-10 overflow-hidden border-y border-white/10 bg-background/90 py-2">
      <style>{`@keyframes halisia-material-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .halisia-material-track { display: flex; width: max-content; animation: halisia-material-tape 70s linear infinite; }
        .halisia-material-track:hover, .halisia-material-track:focus-within { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .halisia-material-track { animation: none; } }`}</style>
      <div className="flex items-center gap-3">
        <span className="z-10 shrink-0 border-r border-white/15 bg-background px-3 text-[10px] font-bold uppercase tracking-wider text-accent sm:px-5">
          Kenya Build Costs
        </span>
        <div className="min-w-0 overflow-hidden">
          <div className="halisia-material-track">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center whitespace-nowrap">
                {CONSTRUCTION_MATERIALS.map((item) => <MarketItem key={item.id} item={item} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="px-4 pt-1 text-[10px] text-muted-foreground">
        Historical indicative references, not real-time quotes. Delivery and specifications vary by county.
      </p>
    </aside>
  );
}

export function CountyConstructionMarket({ countyName }: { countyName: string }) {
  const data = countyMaterialPricing(countyName);
  return (
    <section id="sec-material-costs" aria-labelledby="county-market-title" className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-accent">Construction intelligence</div>
          <h2 id="county-market-title" className="mt-2 text-xl font-semibold">{countyName} · Material &amp; Labour Costs</h2>
        </div>
        <span className="rounded-full border border-amber-500/40 px-3 py-1 text-xs text-amber-600">National benchmarks · local quotes pending</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{data.locality}. {data.methodology}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/10 bg-background/60 p-3">
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className="mt-1 text-sm font-semibold">{formatMaterialPrice(item)}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {item.coverage === "quote-required" ? "County supplier quotation required" : "Indicative January 2026 reference · NOT a county quote"}
            </div>
            {item.sourceUrl && <a className="mt-1 inline-block text-[11px] text-accent underline" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Published source</a>}
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-white/10 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Market context and data provenance</p>
        <p className="mt-1">KNBS Q2 2026 construction input prices: +5.73% quarter-on-quarter and +5.52% year-on-year. This is a national index change, not a county material quotation.</p>
        <ul className="mt-2 space-y-1">
          {MARKET_SOURCES.map((source) => (
            <li key={source.url}>
              <a className="text-accent underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
              {" — "}{source.note}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
