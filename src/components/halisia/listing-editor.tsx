import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Sparkles,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Wand2,
  GitCompare,
} from "lucide-react";
import { updateProperty, type PropertyRow } from "@/lib/properties";
import {
  generateListingAi,
  type ListingAiInput,
  type ListingAiOutput,
} from "@/lib/ai-listing.functions";

export type ListingAiVersion = {
  savedAt: string;
  label: string;
  ai: ListingAiOutput;
  inputs?: Partial<ListingAiInput>;
};
export type ListingAiWithMeta = ListingAiOutput & {
  _history?: ListingAiVersion[];
  _inputs?: Partial<ListingAiInput>;
};

const UTILITY_OPTIONS = [
  "Electricity (KPLC)",
  "Piped water",
  "Borehole",
  "Sewer",
  "Septic",
  "Fibre internet",
  "Street lighting",
];
const ACCESS_OPTIONS = [
  "Tarmac road",
  "All-weather murram",
  "Seasonal murram",
  "Footpath only",
  "Private access road",
];

function stripMeta(ai: ListingAiWithMeta): ListingAiOutput {
  const { _history, _inputs, ...rest } = ai;
  void _history;
  void _inputs;
  return rest;
}

function pushVersion(base: ListingAiWithMeta, label: string): ListingAiVersion[] {
  const hist = base._history ?? [];
  const snap: ListingAiVersion = {
    savedAt: new Date().toISOString(),
    label,
    ai: stripMeta(base),
    inputs: base._inputs,
  };
  return [snap, ...hist].slice(0, 12);
}

export function ListingEditor({ property, ai }: { property: PropertyRow; ai: ListingAiWithMeta }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [draft, setDraft] = useState<ListingAiOutput>(() => stripMeta(ai));
  const [inputs, setInputs] = useState<Partial<ListingAiInput>>(() => ({
    amenities: property.amenities ?? [],
    utilities: property.utilities ?? [],
    access_type: ai._inputs?.access_type ?? null,
    size_value: property.size_value,
    size_unit: property.size_unit,
    ...(ai._inputs ?? {}),
  }));
  const [amenitiesText, setAmenitiesText] = useState((inputs.amenities ?? []).join(", "));

  const persist = useMutation({
    mutationFn: async (next: ListingAiWithMeta) => {
      await updateProperty(property.id, {
        ai_summary: next as unknown as PropertyRow["ai_summary"],
      });
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property", property.id] }),
  });

  const save = useMutation({
    mutationFn: async () => {
      const next: ListingAiWithMeta = {
        ...draft,
        _inputs: { ...inputs, amenities: parseAmenities(amenitiesText) },
        _history: pushVersion(ai, "Manual edit"),
      };
      return persist.mutateAsync(next);
    },
  });

  const regenAll = useMutation({
    mutationFn: async () => {
      const merged: ListingAiInput = {
        title: property.title,
        description: property.description,
        kind: property.kind,
        intent: property.intent,
        price: property.price,
        currency: property.currency,
        size_value: inputs.size_value ?? property.size_value,
        size_unit: (inputs.size_unit as string | null) ?? property.size_unit,
        county: property.county,
        address: property.address,
        latitude: property.latitude,
        longitude: property.longitude,
        amenities: parseAmenities(amenitiesText),
        utilities: inputs.utilities ?? [],
        access_type: inputs.access_type ?? null,
      };
      const fresh = await generateListingAi({ data: merged });
      const next: ListingAiWithMeta = {
        ...fresh,
        _inputs: merged,
        _history: pushVersion(ai, "Regenerated (all)"),
      };
      setDraft(stripMeta(next));
      return persist.mutateAsync(next);
    },
  });

  const regenConcepts = useMutation({
    mutationFn: async () => {
      const merged: ListingAiInput = {
        title: property.title,
        description: property.description,
        kind: property.kind,
        intent: property.intent,
        price: property.price,
        currency: property.currency,
        size_value: inputs.size_value ?? property.size_value,
        size_unit: (inputs.size_unit as string | null) ?? property.size_unit,
        county: property.county,
        address: property.address,
        latitude: property.latitude,
        longitude: property.longitude,
        amenities: parseAmenities(amenitiesText),
        utilities: inputs.utilities ?? [],
        access_type: inputs.access_type ?? null,
      };
      const fresh = await generateListingAi({ data: merged });
      const nextDraft: ListingAiOutput = { ...draft, concepts: fresh.concepts };
      setDraft(nextDraft);
      const next: ListingAiWithMeta = {
        ...nextDraft,
        _inputs: merged,
        _history: pushVersion(ai, "Regenerated concepts"),
      };
      return persist.mutateAsync(next);
    },
  });

  const restore = useMutation({
    mutationFn: async (v: ListingAiVersion) => {
      const next: ListingAiWithMeta = {
        ...v.ai,
        _inputs: v.inputs,
        _history: pushVersion(ai, `Restored: ${v.label}`),
      };
      setDraft(stripMeta(next));
      return persist.mutateAsync(next);
    },
  });

  const isBusy =
    save.isPending || regenAll.isPending || regenConcepts.isPending || restore.isPending;

  const history = useMemo(() => ai._history ?? [], [ai]);

  const versionsById = useMemo(() => {
    const map = new Map<string, ListingAiVersion>();
    for (const v of history) map.set(v.savedAt, v);
    return map;
  }, [history]);
  const currentSnap: ListingAiVersion = useMemo(
    () => ({
      savedAt: "current",
      label: "Current draft",
      ai: draft,
      inputs: { ...inputs, amenities: parseAmenities(amenitiesText) },
    }),
    [draft, inputs, amenitiesText],
  );
  const getSnap = (id: string): ListingAiVersion | null =>
    id === "current" ? currentSnap : (versionsById.get(id) ?? null);

  return (
    <section
      data-testid="listing-editor"
      className="mt-6 glass rounded-2xl border border-white/10 p-5"
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-accent inline-flex items-center gap-1">
            <Wand2 className="h-3 w-3" /> Owner tools · Edit AI content
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Refine any AI-drafted field, tweak the inputs and regenerate. Every save keeps a version
            snapshot you can restore.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 text-xs"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {open ? "Close editor" : "Open editor"}
        </button>
      </header>

      {open && (
        <div className="mt-4 grid gap-4">
          <TextField
            label="Polished title"
            value={draft.polishedTitle}
            onChange={(v) => setDraft({ ...draft, polishedTitle: v })}
          />
          <TextField
            label="Headline"
            value={draft.headline}
            onChange={(v) => setDraft({ ...draft, headline: v })}
          />
          <TextAreaField
            label="AI summary"
            rows={3}
            value={draft.aiSummary}
            onChange={(v) => setDraft({ ...draft, aiSummary: v })}
          />
          <TextAreaField
            label="Marketing highlights (one per line)"
            rows={5}
            value={draft.marketingHighlights.join("\n")}
            onChange={(v) =>
              setDraft({
                ...draft,
                marketingHighlights: v
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 8),
              })
            }
          />
          <TextAreaField
            label="SEO description (≤ 158 chars)"
            rows={2}
            value={draft.seoDescription}
            onChange={(v) => setDraft({ ...draft, seoDescription: v.slice(0, 158) })}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["twitter", "Twitter / X"],
                ["facebook", "Facebook"],
                ["whatsapp", "WhatsApp"],
                ["instagram", "Instagram"],
              ] as const
            ).map(([k, label]) => (
              <TextAreaField
                key={k}
                label={label}
                rows={3}
                value={draft.socialCaptions[k]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    socialCaptions: { ...draft.socialCaptions, [k]: v },
                  })
                }
              />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="text-muted-foreground">Est. price min</span>
              <input
                type="number"
                className="input mt-1"
                value={draft.priceEstimate.min ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceEstimate: {
                      ...draft.priceEstimate,
                      min: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Est. price max</span>
              <input
                type="number"
                className="input mt-1"
                value={draft.priceEstimate.max ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceEstimate: {
                      ...draft.priceEstimate,
                      max: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">Currency</span>
              <input
                className="input mt-1"
                value={draft.priceEstimate.currency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priceEstimate: {
                      ...draft.priceEstimate,
                      currency: e.target.value.toUpperCase().slice(0, 4),
                    },
                  })
                }
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-widest text-accent mb-2">
              Regeneration inputs
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-muted-foreground">Amenities (comma separated)</span>
                <input
                  className="input mt-1"
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Access</span>
                <select
                  className="input mt-1"
                  value={inputs.access_type ?? ""}
                  onChange={(e) => setInputs({ ...inputs, access_type: e.target.value || null })}
                >
                  <option value="">— select —</option>
                  {ACCESS_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground">Plot size</span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    className="input flex-1"
                    value={inputs.size_value ?? ""}
                    onChange={(e) =>
                      setInputs({
                        ...inputs,
                        size_value: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <select
                    className="input w-24"
                    value={(inputs.size_unit as string) ?? "acres"}
                    onChange={(e) => setInputs({ ...inputs, size_unit: e.target.value })}
                  >
                    <option value="acres">acres</option>
                    <option value="ha">ha</option>
                    <option value="sqm">sqm</option>
                    <option value="sqft">sqft</option>
                  </select>
                </div>
              </label>
              <div className="text-xs">
                <span className="text-muted-foreground">Utilities on-site</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {UTILITY_OPTIONS.map((u) => {
                    const on = (inputs.utilities ?? []).includes(u);
                    return (
                      <button
                        type="button"
                        key={u}
                        onClick={() =>
                          setInputs({
                            ...inputs,
                            utilities: on
                              ? (inputs.utilities ?? []).filter((x) => x !== u)
                              : [...(inputs.utilities ?? []), u],
                          })
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          on
                            ? "border-accent bg-accent/20 text-accent"
                            : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={on}
                      >
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => save.mutate()}
              data-testid="editor-save"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 text-xs font-medium disabled:opacity-60"
            >
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save changes
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => regenConcepts.mutate()}
              data-testid="editor-regen-concepts"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-xs disabled:opacity-60"
            >
              {regenConcepts.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Regenerate concepts
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => regenAll.mutate()}
              data-testid="editor-regen-all"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-xs disabled:opacity-60"
            >
              {regenAll.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Regenerate everything
            </button>
            {persist.isError && (
              <span role="alert" className="text-xs text-red-300 self-center">
                Couldn't save — try again.
              </span>
            )}
            {persist.isSuccess && !isBusy && (
              <span className="text-xs text-emerald-glow self-center">Saved ✓</span>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-accent"
            >
              <History className="h-3.5 w-3.5" />
              Version history ({history.length})
              {showHistory ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showHistory && (
              <ul className="mt-3 grid gap-2">
                {history.length === 0 && (
                  <li className="text-xs text-muted-foreground">
                    No previous versions yet — save or regenerate to create one.
                  </li>
                )}
                {history.map((v) => (
                  <li
                    key={v.savedAt}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium">{v.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(v.savedAt).toLocaleString()} · {v.ai.polishedTitle.slice(0, 60)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCompare({ a: "current", b: v.savedAt })}
                        data-testid={`compare-${v.savedAt}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 text-[11px]"
                      >
                        <GitCompare className="h-3 w-3" /> Compare
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => restore.mutate(v)}
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 text-[11px] disabled:opacity-60"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {compare && (
              <VersionDiff
                a={getSnap(compare.a)}
                b={getSnap(compare.b)}
                versions={[currentSnap, ...history]}
                onChange={(a, b) => setCompare({ a, b })}
                onClose={() => setCompare(null)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function VersionDiff({
  a,
  b,
  versions,
  onChange,
  onClose,
}: {
  a: ListingAiVersion | null;
  b: ListingAiVersion | null;
  versions: ListingAiVersion[];
  onChange: (a: string, b: string) => void;
  onClose: () => void;
}) {
  if (!a || !b) return null;
  const rows: Array<{ label: string; a: string; b: string }> = [
    { label: "Polished title", a: a.ai.polishedTitle, b: b.ai.polishedTitle },
    { label: "Headline", a: a.ai.headline, b: b.ai.headline },
    { label: "AI summary", a: a.ai.aiSummary, b: b.ai.aiSummary },
    {
      label: "Marketing highlights",
      a: a.ai.marketingHighlights.join("\n• "),
      b: b.ai.marketingHighlights.join("\n• "),
    },
    { label: "SEO description", a: a.ai.seoDescription, b: b.ai.seoDescription },
    { label: "Twitter / X", a: a.ai.socialCaptions.twitter, b: b.ai.socialCaptions.twitter },
    { label: "Facebook", a: a.ai.socialCaptions.facebook, b: b.ai.socialCaptions.facebook },
    { label: "WhatsApp", a: a.ai.socialCaptions.whatsapp, b: b.ai.socialCaptions.whatsapp },
    { label: "Instagram", a: a.ai.socialCaptions.instagram, b: b.ai.socialCaptions.instagram },
    {
      label: "Estimated price band",
      a: `${a.ai.priceEstimate.currency} ${a.ai.priceEstimate.min ?? "—"} – ${a.ai.priceEstimate.max ?? "—"}`,
      b: `${b.ai.priceEstimate.currency} ${b.ai.priceEstimate.min ?? "—"} – ${b.ai.priceEstimate.max ?? "—"}`,
    },
    {
      label: "Concepts",
      a: a.ai.concepts
        .map((c) => `${c.name} (${c.confidencePct}%) — ${c.description}`)
        .join("\n\n"),
      b: b.ai.concepts
        .map((c) => `${c.name} (${c.confidencePct}%) — ${c.description}`)
        .join("\n\n"),
    },
  ];
  return (
    <div
      data-testid="version-diff"
      className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">Side-by-side comparison</span>
        <select
          className="input py-1 h-8"
          value={a.savedAt}
          onChange={(e) => onChange(e.target.value, b.savedAt)}
          aria-label="Version A"
        >
          {versions.map((v) => (
            <option key={v.savedAt} value={v.savedAt}>
              A · {v.label}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">vs</span>
        <select
          className="input py-1 h-8"
          value={b.savedAt}
          onChange={(e) => onChange(a.savedAt, e.target.value)}
          aria-label="Version B"
        >
          {versions.map((v) => (
            <option key={v.savedAt} value={v.savedAt}>
              B · {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1 text-[11px]"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map((r) => {
          const changed = r.a.trim() !== r.b.trim();
          return (
            <div
              key={r.label}
              className={`rounded-xl border p-2 ${
                changed ? "border-accent/40 bg-accent/[0.05]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center justify-between">
                <span>{r.label}</span>
                {changed && <span className="text-accent">changed</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-foreground/85 max-h-40 overflow-auto">
                  {r.a || "—"}
                </pre>
                <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-foreground/85 max-h-40 overflow-auto">
                  {r.b || "—"}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseAmenities(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        rows={rows}
        className="input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
