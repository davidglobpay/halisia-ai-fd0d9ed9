import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  createProperty,
  PROPERTY_KINDS,
  INTENTS,
  type PropertyKind,
  type ListingIntent,
} from "@/lib/properties";

export const Route = createFileRoute("/_authenticated/sell/new")({
  head: () => ({
    meta: [
      { title: "List a property · HALISIA AI" },
      {
        name: "description",
        content: "Create a new listing with AI-generated highlights and a Land Intelligence Score.",
      },
    ],
  }),
  component: SellNew,
});

function SellNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "land" as PropertyKind,
    intent: "sale" as ListingIntent,
    price: "",
    currency: "KES",
    size_value: "",
    size_unit: "acres",
    county: "",
    address: "",
    latitude: "",
    longitude: "",
    cover_image: "",
    amenities: "",
    publish: true,
  });

  const m = useMutation({
    mutationFn: async () => {
      return createProperty({
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        intent: form.intent,
        status: form.publish ? "published" : "draft",
        price: form.price ? Number(form.price) : null,
        currency: form.currency || "KES",
        size_value: form.size_value ? Number(form.size_value) : null,
        size_unit: form.size_unit || "acres",
        county: form.county.trim() || null,
        address: form.address.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        cover_image: form.cover_image.trim() || null,
        amenities: form.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    },
    onSuccess: (row) => navigate({ to: "/marketplace/$id", params: { id: row.id } }),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Seller Centre</div>
        <h1 className="text-3xl font-display font-semibold mt-1">List a property</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the essentials. AI enrichment (title polish, marketing highlights, price band,
          Land Intelligence Score) runs automatically on the listing page.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
        className="glass rounded-2xl border border-white/10 p-5 grid gap-4"
      >
        <Field label="Listing title" required>
          <input
            required
            maxLength={140}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            className="input"
            placeholder="e.g. 0.25 acre plot near Tatu City"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as PropertyKind)}
              className="input"
            >
              {PROPERTY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intent">
            <select
              value={form.intent}
              onChange={(e) => set("intent", e.target.value as ListingIntent)}
              className="input"
            >
              {INTENTS.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price">
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              className="input"
              placeholder="0"
            />
          </Field>
          <Field label="Currency">
            <input
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 4))}
              className="input"
            />
          </Field>
          <Field label="Size">
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={form.size_value}
                onChange={(e) => set("size_value", e.target.value)}
                className="input flex-1"
              />
              <select
                value={form.size_unit}
                onChange={(e) => set("size_unit", e.target.value)}
                className="input w-24"
              >
                <option value="acres">acres</option>
                <option value="ha">ha</option>
                <option value="sqm">sqm</option>
                <option value="sqft">sqft</option>
              </select>
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="County">
            <input
              value={form.county}
              onChange={(e) => set("county", e.target.value)}
              className="input"
              placeholder="Nairobi"
            />
          </Field>
          <Field label="Address / neighbourhood">
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className="input"
              placeholder="Kilimani"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" hint="Optional but enables LIOS + maps">
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => set("latitude", e.target.value)}
              className="input"
              placeholder="-1.29"
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => set("longitude", e.target.value)}
              className="input"
              placeholder="36.82"
            />
          </Field>
        </div>

        <Field label="Cover image URL">
          <input
            value={form.cover_image}
            onChange={(e) => set("cover_image", e.target.value)}
            className="input"
            placeholder="https://…"
          />
        </Field>

        <Field label="Amenities" hint="Comma separated (Water, Fibre, Perimeter fence…)">
          <input
            value={form.amenities}
            onChange={(e) => set("amenities", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={5}
            maxLength={4000}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="input"
            placeholder="What makes this property special?"
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={form.publish}
            onChange={(e) => set("publish", e.target.checked)}
          />
          Publish immediately (uncheck to save as draft)
        </label>

        {m.isError && (
          <div role="alert" className="text-xs text-red-300">
            {(m.error as Error)?.message ?? "Couldn't save the listing."}
          </div>
        )}

        <button
          type="submit"
          disabled={m.isPending || !form.title.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {m.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {form.publish ? "Publish listing" : "Save draft"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          AI-generated fields are estimates. Confirm price and legal details with a licensed
          professional before transacting.
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}