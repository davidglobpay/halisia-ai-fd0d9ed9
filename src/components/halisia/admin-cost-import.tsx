import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { importCostCsv } from "@/lib/cost-intel.functions";

const TABLES = [
  ["land_price_obs", "Land price observations"],
  ["material_price", "Material prices"],
  ["boq_template", "BoQ templates"],
  ["boq_labour", "BoQ labour"],
  ["labour_rate", "Labour rates"],
] as const;

/**
 * Administrator CSV import for the cost-intelligence tables. Rows are
 * validated server-side; rejected rows are reported, never silently dropped
 * or corrected.
 */
export function AdminCostImport() {
  const run = useServerFn(importCostCsv);
  const [table, setTable] = useState<(typeof TABLES)[number][0]>("land_price_obs");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    rejected: number;
    errors: string[];
  } | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const r = await run({ data: { table, csv } });
      setResult(r);
      if (r.inserted > 0) toast.success(`Imported ${r.inserted} rows into ${table}`);
      else toast.error(`No rows imported — ${r.rejected} rejected`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3"
      data-testid="admin-cost-import"
    >
      <h2 className="text-sm font-medium">Cost intelligence CSV import</h2>
      <p className="text-[11px] text-muted-foreground">
        Header row required. Rows are validated; anything invalid is rejected and listed.
      </p>
      <label className="flex items-center gap-2 text-xs">
        Table
        <select
          className="min-h-11 rounded-lg border border-white/15 bg-background px-2"
          value={table}
          onChange={(e) => setTable(e.target.value as typeof table)}
          data-testid="aci-table"
        >
          {TABLES.map(([id, labelText]) => (
            <option key={id} value={id}>
              {labelText}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="h-32 w-full rounded-lg border border-white/15 bg-background p-2 font-mono text-[11px]"
        placeholder="county,plot_size_sqft,price_kes,source_type,observed_date,…"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        data-testid="aci-csv"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !csv.trim()}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 px-3 text-xs font-medium hover:bg-white/10 disabled:opacity-60"
        data-testid="aci-submit"
      >
        {busy ? "Importing…" : "Validate & import"}
      </button>
      {result ? (
        <div className="text-xs" data-testid="aci-result">
          <p>
            Inserted {result.inserted} · rejected {result.rejected}
          </p>
          {result.errors.length ? (
            <ul className="mt-1 max-h-32 overflow-auto font-mono text-[10px] text-muted-foreground">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
