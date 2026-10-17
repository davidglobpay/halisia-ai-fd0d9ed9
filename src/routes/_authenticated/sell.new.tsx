import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  createProperty,
  updateProperty,
  PROPERTY_KINDS,
  INTENTS,
  type PropertyKind,
  type ListingIntent,
} from "@/lib/properties";
import { generateListingAi } from "@/lib/ai-listing.functions";
import { coachListing, type CoachOutput } from "@/lib/listing-coach.functions";
import { SELLER_REVIEW_SUBMISSION } from "@/lib/seller-moderation";
import { uploadListingPhoto } from "@/lib/listing-media";
import {
  upsertRentalDetails,
  FURNISHING_OPTIONS,
  RENTAL_UTILITIES,
  SECURITY_FEATURES,
  ACCESSIBILITY_FEATURES,
} from "@/lib/rentals";
import { PinPicker } from "@/components/halisia/pin-picker";
import {
  EMPTY_DRAFT,
  buildChecklist,
  completeness,
  isRental,
  type WizardDraft,
} from "@/lib/listing-wizard";

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

export const Route = createFileRoute("/_authenticated/sell/new")({
  head: () => ({
    meta: [
      { title: "Guided listing workflow · HALISIA AI" },
      {
        name: "description",
        content:
          "Create a listing step by step with GPS pin, photo uploads, completeness tracking and AI-written copy.",
      },
    ],
  }),
  component: SellNew,
});

const STEPS = [
  "Basics",
  "Location",
  "Land & site",
  "Photos",
  "AI copy",
  "Terms & contact",
  "Review",
];

function SellNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardDraft>(EMPTY_DRAFT);
  const [coach, setCoach] = useState<CoachOutput | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const checklist = useMemo(() => buildChecklist(form), [form]);
  const pct = completeness(checklist);
  const rental = isRental(form);

  const set = <K extends keyof WizardDraft>(k: K, v: WizardDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleIn = (
    k: "utilities" | "utilities_included" | "security_features" | "accessibility_features",
    v: string,
  ) =>
    setForm((f) => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
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
          amenities: form.amenities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          utilities: form.utilities,
          access_type: form.access_type || null,
          photos: form.media_urls.length,
          hasPin: !!(form.latitude && form.longitude),
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
      for (const f of Array.from(files).slice(0, 10)) {
        urls.push(await uploadListingPhoto(f));
      }
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

  const m = useMutation({
    mutationFn: async () => {
      const amenitiesArr = form.amenities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const row = await createProperty({
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        intent: form.intent,
        ...SELLER_REVIEW_SUBMISSION,
        submitted_at: new Date().toISOString(),
        completeness_pct: pct,
        media_urls: form.media_urls,
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
        cover_image: form.cover_image.trim() || form.media_urls[0] || null,
        amenities: amenitiesArr,
        utilities: form.utilities,
      });

      if (rental) {
        try {
          await upsertRentalDetails({
            property_id: row.id,
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

      // Fire AI enrichment and persist to the draft. Non-fatal if it fails.
      try {
        const ai = await generateListingAi({
          data: {
            title: row.title,
            description: row.description,
            kind: row.kind,
            intent: row.intent,
            price: row.price,
            currency: row.currency,
            size_value: row.size_value,
            size_unit: row.size_unit,
            county: row.county,
            address: row.address,
            latitude: row.latitude,
            longitude: row.longitude,
            amenities: row.amenities,
            utilities: row.utilities,
            access_type: form.access_type || null,
          },
        });
        await updateProperty(row.id, {
          ai_summary:
            ai as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["properties"]["Update"]["ai_summary"],
        });
      } catch (err) {
        console.warn("AI enrichment skipped", err);
      }
      return row;
    },
    onSuccess: (row) => navigate({ to: "/marketplace/$id", params: { id: row.id } }),
  });

  const missingRequired = !form.title.trim();

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-3xl mx-auto">
      <header className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Seller Centre</div>
        <h1 className="text-3xl font-display font-semibold mt-1">Guided listing workflow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seven guided steps with a GPS/map pin, photo uploads, live completeness tracking and AI
          copy you can accept or edit before submitting for review.
        </p>
      </header>

      {/* Completeness */}
      <section
        aria-label="Listing completeness"
        className="glass rounded-2xl border border-white/10 p-4 mb-4"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-widest text-muted-foreground">Completeness</span>
          <span className="font-numeric text-lg">{pct}%</span>
        </div>
        <div
          className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {checklist.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setStep(c.step - 1)}
                className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
                  c.done
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
                title={c.why}
              >
                {c.done ? "✓ " : "• "}
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps nav */}
      <ol className="mb-4 flex flex-wrap gap-1.5 text-[10px]" aria-label="Workflow steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full border px-3 py-1 uppercase tracking-widest transition ${
                i === step
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === STEPS.length - 1) m.mutate();
          else setStep((s) => Math.min(STEPS.length - 1, s + 1));
        }}
        className="glass rounded-2xl border border-white/10 p-5 grid gap-4"
      >
        {step === 0 && (
          <>
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
          </>
        )}

        {step === 1 && (
          <>
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

            <PinPicker
              lat={form.latitude ? Number(form.latitude) : null}
              lng={form.longitude ? Number(form.longitude) : null}
              onPick={(lat, lng) =>
                setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
              }
            />

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
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Amenities" hint="Comma separated (Water, Fibre, Perimeter fence…)">
              <input
                value={form.amenities}
                onChange={(e) => set("amenities", e.target.value)}
                className="input"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bedrooms">
                <input
                  type="number"
                  min={0}
                  value={form.bedrooms}
                  onChange={(e) => set("bedrooms", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Bathrooms">
                <input
                  type="number"
                  min={0}
                  value={form.bathrooms}
                  onChange={(e) => set("bathrooms", e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Access" hint="How does one reach the plot?">
              <select
                value={form.access_type}
                onChange={(e) => set("access_type", e.target.value)}
                className="input"
              >
                <option value="">— select —</option>
                {ACCESS_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Utilities on-site" hint="Tick everything already available.">
              <div className="flex flex-wrap gap-2">
                {UTILITY_OPTIONS.map((u) => {
                  const on = form.utilities.includes(u);
                  return (
                    <button
                      type="button"
                      key={u}
                      onClick={() => toggleIn("utilities", u)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
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
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field
              label="Upload photos"
              hint="JPG/PNG up to 8MB each. Three or more performs best."
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void onFiles(e.target.files)}
                  className="hidden"
                  id="listing-photos"
                />
                <label
                  htmlFor="listing-photos"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Choose photos
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {form.media_urls.length} uploaded
                </span>
              </div>
            </Field>
            {uploadError && (
              <p role="alert" className="text-xs text-red-300">
                {uploadError}
              </p>
            )}
            {form.media_urls.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {form.media_urls.map((u) => (
                  <li
                    key={u}
                    className="relative overflow-hidden rounded-xl border border-white/10"
                  >
                    <img
                      src={u}
                      alt="Listing upload"
                      className="h-24 w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1.5 py-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => set("cover_image", u)}
                        className={form.cover_image === u ? "text-accent" : "text-white/70"}
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
                  </li>
                ))}
              </ul>
            )}
            <Field label="Or paste a cover image URL">
              <input
                value={form.cover_image}
                onChange={(e) => set("cover_image", e.target.value)}
                className="input"
                placeholder="https://…"
              />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => coachM.mutate()}
                disabled={coachM.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {coachM.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Generate AI title & description
              </button>
              {coach && (
                <span className="text-[11px] text-muted-foreground">
                  Confidence {coach.confidencePct}% ·{" "}
                  {new Date(coach.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {coach && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    AI suggested title
                  </div>
                  <p className="mt-1 text-sm">{coach.suggestedTitle}</p>
                  <button
                    type="button"
                    onClick={() => set("title", coach.suggestedTitle)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" /> Use this title
                  </button>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    AI suggested description
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm">{coach.suggestedDescription}</p>
                  <button
                    type="button"
                    onClick={() => set("description", coach.suggestedDescription)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" /> Use this description
                  </button>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-amber-200 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Missing information
                  </div>
                  <ul className="mt-2 grid gap-1.5 text-xs">
                    {coach.missing.map((mi) => (
                      <li key={mi.label}>
                        <span className="font-medium">{mi.label}</span>{" "}
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {mi.severity}
                        </span>
                        <div className="text-muted-foreground">{mi.why}</div>
                      </li>
                    ))}
                  </ul>
                  {coach.improvements.length > 0 && (
                    <ul className="mt-3 list-disc pl-4 text-[11px] text-muted-foreground">
                      {coach.improvements.map((im) => (
                        <li key={im}>{im}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

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
          </>
        )}

        {step === 5 && (
          <>
            {rental ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Monthly rent">
                    <input
                      type="number"
                      min={0}
                      value={form.monthly_rent}
                      onChange={(e) => set("monthly_rent", e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Deposit">
                    <input
                      type="number"
                      min={0}
                      value={form.deposit}
                      onChange={(e) => set("deposit", e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Service charge">
                    <input
                      type="number"
                      min={0}
                      value={form.service_charge}
                      onChange={(e) => set("service_charge", e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Available from">
                    <input
                      type="date"
                      value={form.available_from}
                      onChange={(e) => set("available_from", e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Furnishing">
                    <select
                      value={form.furnishing}
                      onChange={(e) => set("furnishing", e.target.value)}
                      className="input"
                    >
                      <option value="">— select —</option>
                      {FURNISHING_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Parking spaces">
                    <input
                      type="number"
                      min={0}
                      value={form.parking_spaces}
                      onChange={(e) => set("parking_spaces", e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>
                <Chips
                  label="Utilities included in rent"
                  options={RENTAL_UTILITIES}
                  value={form.utilities_included}
                  onToggle={(v) => toggleIn("utilities_included", v)}
                />
                <Chips
                  label="Security"
                  options={SECURITY_FEATURES}
                  value={form.security_features}
                  onToggle={(v) => toggleIn("security_features", v)}
                />
                <Chips
                  label="Accessibility"
                  options={ACCESSIBILITY_FEATURES}
                  value={form.accessibility_features}
                  onToggle={(v) => toggleIn("accessibility_features", v)}
                />
                <Field
                  label="Public transport"
                  hint="Nearest matatu stage, bus route, commuter rail…"
                >
                  <input
                    value={form.public_transport}
                    onChange={(e) => set("public_transport", e.target.value)}
                    className="input"
                  />
                </Field>
                <Field label="House rules">
                  <textarea
                    rows={3}
                    value={form.house_rules}
                    onChange={(e) => set("house_rules", e.target.value)}
                    className="input"
                  />
                </Field>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Rental terms apply to “For rent” and “For lease” listings. Switch the intent in step
                1 to capture rent, deposit, furnishing and house rules.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Contact name">
                <input
                  value={form.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Contact phone">
                <input
                  value={form.contact_phone}
                  onChange={(e) => set("contact_phone", e.target.value)}
                  className="input"
                  placeholder="+254…"
                />
              </Field>
              <Field label="Contact email">
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field
              label="Viewing instructions"
              hint="When can people view, and what should they bring?"
            >
              <textarea
                rows={3}
                value={form.viewing_instructions}
                onChange={(e) => set("viewing_instructions", e.target.value)}
                className="input"
              />
            </Field>
          </>
        )}

        {step === 6 && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">{form.title || "Untitled listing"}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {form.kind} · {form.intent} · {form.county || "County not set"} ·{" "}
                {form.latitude && form.longitude ? "GPS pin set" : "No GPS pin"} ·{" "}
                {form.media_urls.length} photo(s)
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-4">
                {form.description || "No description yet."}
              </p>
            </div>

            {checklist.some((c) => !c.done) && (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs">
                <div className="font-medium text-amber-200">Still missing</div>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {checklist
                    .filter((c) => !c.done)
                    .map((c) => (
                      <li key={c.key}>
                        {c.label} — {c.why}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Saving keeps this listing private and submits it for authorized moderation. Submission
              does not verify title, ownership or location.
            </p>
          </>
        )}

        {m.isError && (
          <div role="alert" className="text-xs text-red-300">
            {(m.error as Error)?.message ?? "Couldn't save the listing."}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-xs disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
          </button>
          <button
            type="submit"
            disabled={m.isPending || (step === STEPS.length - 1 && missingRequired)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {m.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : step === STEPS.length - 1 ? (
              <Send className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            )}
            {step === STEPS.length - 1 ? "Submit for review" : "Continue"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          On submit, HALISIA AI drafts your title, marketing highlights, SEO description, price band
          and (for land) concept layouts — labelled as estimates. Confirm price and legal details
          with a licensed professional before transacting.
        </p>
      </form>
    </main>
  );
}

function Chips({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onToggle(o)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                on
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </Field>
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
