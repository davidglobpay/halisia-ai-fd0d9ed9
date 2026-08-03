import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ImagePlus, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { getProperty, updateProperty, PROPERTY_KINDS, INTENTS, type PropertyKind, type ListingIntent } from "@/lib/properties";
import { getRentalDetails, upsertRentalDetails, FURNISHING_OPTIONS } from "@/lib/rentals";
import { uploadListingPhoto } from "@/lib/listing-media";
import { coachListing, type CoachOutput } from "@/lib/listing-coach.functions";
import { EMPTY_DRAFT, buildChecklist, completeness, isRental, type WizardDraft } from "@/lib/listing-wizard";
import { listingClarifications, answersToNotes, type ClarifyAnswers } from "@/lib/clarify";
import { ClarifyStep } from "@/components/halisia/clarify-step";
import { PinPicker } from "@/components/halisia/pin-picker";

export const Route = createFileRoute("/_authenticated/sell/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit & resubmit listing · HALISIA AI" },
      {
        name: "description",
        content:
          "Update your listing, keep the photos you already uploaded, recalculate completeness and refresh the AI missing-information checklist before resubmitting.",
      },
    ],
  }),
  component: EditListing,
});

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

function EditListing() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<WizardDraft>(EMPTY_DRAFT);
  const [answers, setAnswers] = useState<ClarifyAnswers>({});
  const [coach, setCoach] = useState<CoachOutput | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publish, setPublish] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["listing-edit", id],
    queryFn: async () => {
      const property = await getProperty(id);
      if (!property) throw new Error("Listing not found");
      const rental = await getRentalDetails(id).catch(() => null);
      return { property, rental };
    },
  });

  // Hydrate the wizard draft once, preserving already-uploaded media.
  useEffect(() => {
    if (!q.data) return;
    const { property: p, rental: r } = q.data;
    setForm({
      ...EMPTY_DRAFT,
      title: p.title ?? "",
      description: p.description ?? "",
      kind: p.kind,
      intent: p.intent,
      price: p.price != null ? String(p.price) : "",
      currency: p.currency || "KES",
      size_value: p.size_value != null ? String(p.size_value) : "",
      size_unit: p.size_unit || "acres",
      county: p.county ?? "",
      address: p.address ?? "",
      latitude: p.latitude != null ? String(p.latitude) : "",
      longitude: p.longitude != null ? String(p.longitude) : "",
      cover_image: p.cover_image ?? "",
      media_urls: p.media_urls ?? [],
      amenities: (p.amenities ?? []).join(", "),
      utilities: p.utilities ?? [],
      bedrooms: p.bedrooms != null ? String(p.bedrooms) : "",
      bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
      monthly_rent: r?.monthly_rent != null ? String(r.monthly_rent) : "",
      deposit: r?.deposit != null ? String(r.deposit) : "",
      service_charge: r?.service_charge != null ? String(r.service_charge) : "",
      available_from: r?.available_from ?? "",
      furnishing: r?.furnishing ?? "",
      parking_spaces: r?.parking_spaces != null ? String(r.parking_spaces) : "",
      utilities_included: r?.utilities_included ?? [],
      security_features: r?.security_features ?? [],
      accessibility_features: r?.accessibility_features ?? [],
      public_transport: r?.public_transport ?? "",
      house_rules: r?.house_rules ?? "",
      contact_name: r?.contact_name ?? "",
      contact_phone: r?.contact_phone ?? "",
      contact_email: r?.contact_email ?? "",
      viewing_instructions: r?.viewing_instructions ?? "",
    });
    setPublish(p.status === "published");
  }, [q.data]);

  const checklist = useMemo(() => buildChecklist(form), [form]);
  const pct = completeness(checklist);
  const rental = isRental(form);
  const clarifications = useMemo(() => listingClarifications(form), [form]);

  const set = <K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleUtility = (v: string) =>
    setForm((f) => ({
      ...f,
      utilities: f.utilities.includes(v) ? f.utilities.filter((x) => x !== v) : [...f.utilities, v],
    }));

  const coachM = useMutation({
    mutationFn: async () =>
      coachListing({
        data: {
          title: form.title,
          description: form.description,
          kind: form.kind,
          intent: form.intent,
          county: form.county || null,
          address: form.address || null,
          price: form.price ? Number(form.price) : null,
          monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
          currency: form.currency,
          size_value: form.size_value ? Number(form.size_value) : null,
          size_unit: form.size_unit,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
          utilities: form.utilities,
          access_type: form.access_type || null,
          photos: form.media_urls.length,
          hasPin: !!(form.latitude && form.longitude),
          clarifications: answersToNotes(clarifications, answers),
        },
      }),
    onSuccess: (out) => setCoach(out),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 10)) urls.push(await uploadListingPhoto(f));
      setForm((prev) => ({
        ...prev,
        media_urls: [...prev.media_urls, ...urls].slice(0, 20),
        cover_image: prev.cover_image || urls[0] || "",
      }));
    } catch (e) {
      setUploadError((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveM = useMutation({
    mutationFn: async () => {
      const row = await updateProperty(id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        intent: form.intent,
        status: publish ? "published" : "draft",
        review_state: publish ? "approved" : "in_review",
        submitted_at: new Date().toISOString(),
        completeness_pct: pct,
        media_urls: form.media_urls,
        cover_image: form.cover_image.trim() || form.media_urls[0] || null,
        price: form.price ? Number(form.price) : null,
        currency: form.currency || "KES",
        size_value: form.size_value ? Number(form.size_value) : null,
        size_unit: form.size_unit || "acres",
        county: form.county.trim() || null,
        address: form.address.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        utilities: form.utilities,
      });
      if (rental) {
        try {
          await upsertRentalDetails({
            property_id: id,
            monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
            deposit: form.deposit ? Number(form.deposit) : null,
            service_charge: form.service_charge ? Number(form.service_charge) : null,
            currency: form.currency || "KES",
            available_from: form.available_from || null,
            bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
            bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
            furnishing: form.furnishing || null,
            parking_spaces: form.parking_spaces ? Number(form.parking_spaces) : null,
            utilities_included: form.utilities_included,
            security_features: form.security_features,
            accessibility_features: form.accessibility_features,
            public_transport: form.public_transport || null,
            house_rules: form.house_rules || null,
            contact_name: form.contact_name || null,
            contact_phone: form.contact_phone || null,
            contact_email: form.contact_email || null,
            viewing_instructions: form.viewing_instructions || null,
          });
        } catch (err) {
          console.warn("rental details save failed", err);
        }
      }
      return row;
    },
    onSuccess: (row) => navigate({ to: "/marketplace/$id", params: { id: row.id } }),
  });

  if (q.isLoading)
    return (
      <main className="min-h-dvh grid place-items-center pt-24">
        <Loader2 className="h-5 w-5 animate-spin text-accent" aria-label="Loading listing" />
      </main>
    );

  if (q.error)
    return (
      <main className="min-h-dvh px-4 pt-24 max-w-2xl mx-auto">
        <p className="text-sm text-red-300">{(q.error as Error).message}</p>
        <Link to="/dashboard" className="mt-3 inline-block text-sm text-accent underline">
          Back to dashboard
        </Link>
      </main>
    );

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-3xl mx-auto" data-testid="listing-edit">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="mt-3 mb-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Seller Centre</div>
        <h1 className="text-3xl font-display font-semibold mt-1">Edit &amp; resubmit listing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your uploaded photos are preserved. Completeness recalculates as you type, and you can
          refresh the AI missing-information checklist before resubmitting for review.
        </p>
      </header>

      <section aria-label="Listing completeness" className="glass rounded-2xl border border-white/10 p-4 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">Completeness</span>
          <span className="font-numeric text-lg" data-testid="edit-completeness">{pct}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {checklist.map((c) => (
            <li
              key={c.key}
              title={c.why}
              className={`rounded-full border px-2.5 py-1 text-[10px] ${
                c.done
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-muted-foreground"
              }`}
            >
              {c.done ? "✓ " : "• "}
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveM.mutate();
        }}
        className="glass rounded-2xl border border-white/10 p-5 grid gap-4"
      >
        <Field label="Listing title" required>
          <input required maxLength={140} value={form.title} onChange={(e) => set("title", e.target.value)} className="input" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Property type">
            <select value={form.kind} onChange={(e) => set("kind", e.target.value as PropertyKind)} className="input">
              {PROPERTY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Intent">
            <select value={form.intent} onChange={(e) => set("intent", e.target.value as ListingIntent)} className="input">
              {INTENTS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label={rental ? "Monthly rent" : "Asking price"}>
            <input
              inputMode="numeric"
              value={rental ? form.monthly_rent : form.price}
              onChange={(e) => set(rental ? "monthly_rent" : "price", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Currency">
            <input value={form.currency} onChange={(e) => set("currency", e.target.value)} className="input" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="County">
            <input value={form.county} onChange={(e) => set("county", e.target.value)} className="input" />
          </Field>
          <Field label="Address / locality">
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Map pin">
          <PinPicker
            lat={form.latitude ? Number(form.latitude) : null}
            lng={form.longitude ? Number(form.longitude) : null}
            onChange={(lat, lng) =>
              setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }))
            }
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Size">
            <input inputMode="decimal" value={form.size_value} onChange={(e) => set("size_value", e.target.value)} className="input" />
          </Field>
          <Field label="Size unit">
            <input value={form.size_unit} onChange={(e) => set("size_unit", e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Road access">
          <select value={form.access_type} onChange={(e) => set("access_type", e.target.value)} className="input">
            <option value="">Not stated</option>
            {ACCESS_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Utilities on site</legend>
          <div className="flex flex-wrap gap-1.5">
            {UTILITY_OPTIONS.map((u) => {
              const on = form.utilities.includes(u);
              return (
                <button
                  key={u}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleUtility(u)}
                  className={`rounded-full border px-3 py-1 text-[11px] ${
                    on ? "border-accent bg-accent/20 text-accent" : "border-white/10 bg-white/5 text-muted-foreground"
                  }`}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Nearby amenities (comma separated)">
          <input value={form.amenities} onChange={(e) => set("amenities", e.target.value)} className="input" />
        </Field>

        {/* Media — preserved from the original submission */}
        <fieldset data-testid="edit-media">
          <legend className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
            Photos ({form.media_urls.length}) — existing uploads are kept
          </legend>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {form.media_urls.map((u) => (
              <div key={u} className="relative rounded-lg overflow-hidden border border-white/10">
                <img src={u} alt="Listing photo" loading="lazy" className="h-20 w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => set("cover_image", u)}
                    className={`text-[9px] ${form.cover_image === u ? "text-accent" : "text-white/70"}`}
                  >
                    {form.cover_image === u ? "Cover" : "Set cover"}
                  </button>
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        media_urls: f.media_urls.filter((x) => x !== u),
                        cover_image: f.cover_image === u ? "" : f.cover_image,
                      }))
                    }
                    className="text-red-300"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px]">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {uploading ? "Uploading…" : "Add photos"}
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {uploadError && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-300">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {uploadError}
            </p>
          )}
        </fieldset>

        <Field label="Description">
          <textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} className="input" />
        </Field>

        {rental && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Deposit">
              <input inputMode="numeric" value={form.deposit} onChange={(e) => set("deposit", e.target.value)} className="input" />
            </Field>
            <Field label="Available from">
              <input type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} className="input" />
            </Field>
            <Field label="Furnishing">
              <select value={form.furnishing} onChange={(e) => set("furnishing", e.target.value)} className="input">
                <option value="">Not stated</option>
                {FURNISHING_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact phone">
              <input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className="input" />
            </Field>
          </div>
        )}

        {/* Clarifications */}
        <ClarifyStep questions={clarifications} answers={answers} onChange={setAnswers} />

        {/* AI checklist refresh */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-[0.25em] text-accent">AI missing-information checklist</span>
            <button
              type="button"
              data-testid="refresh-coach"
              onClick={() => coachM.mutate()}
              disabled={coachM.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-accent disabled:opacity-60"
            >
              {coachM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              Refresh checklist
            </button>
          </div>
          {coach ? (
            <div className="mt-2 grid gap-2">
              <ul className="grid gap-1.5">
                {coach.missing.map((m) => (
                  <li key={m.label} className="text-[11px]">
                    <span
                      className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] uppercase ${
                        m.severity === "high"
                          ? "bg-red-500/20 text-red-200"
                          : m.severity === "medium"
                            ? "bg-amber-400/20 text-amber-100"
                            : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {m.severity}
                    </span>
                    <span className="font-medium">{m.label}</span>{" "}
                    <span className="text-muted-foreground">— {m.why}</span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => set("title", coach.suggestedTitle)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px]"
                >
                  Use suggested title: <span className="text-accent">{coach.suggestedTitle}</span>
                </button>
                <button
                  type="button"
                  onClick={() => set("description", coach.suggestedDescription)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px]"
                >
                  Use suggested description
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Refresh to see what a buyer would still ask about this listing.
            </p>
          )}
        </section>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish immediately (uncheck to save as a draft)
        </label>

        {saveM.error && <p className="text-sm text-red-300">{(saveM.error as Error).message}</p>}

        <button
          type="submit"
          disabled={saveM.isPending || !form.title.trim()}
          data-testid="resubmit-listing"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          Save &amp; resubmit
        </button>
      </form>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
