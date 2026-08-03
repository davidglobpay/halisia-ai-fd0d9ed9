import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Crosshair,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { listRentalVacancies, formatRent } from "@/lib/rentals";
import { AvailabilityCalendar } from "@/components/halisia/availability-calendar";
import { ViewingBooking } from "@/components/halisia/viewing-booking";
import { parseAvailability, parseViewings } from "@/lib/rental-availability";
import { ClarifyStep } from "@/components/halisia/clarify-step";
import { renterClarifications, type ClarifyAnswers } from "@/lib/clarify";
import { useMyLocation } from "@/hooks/use-my-location";
import {
  getMyRenterPreferences,
  saveRenterPreferences,
  matchRentals,
  COMMUTE_OPTIONS,
  RENTER_AMENITIES,
  type RenterPreferences,
} from "@/lib/renter-match";

export const Route = createFileRoute("/_authenticated/rentals")({
  head: () => ({
    meta: [
      { title: "Rental vacancies & renter match · HALISIA AI" },
      {
        name: "description",
        content:
          "Browse Kenyan rental vacancies and get consent-based matches on budget, county, bedrooms, commute, schools, security and accessibility.",
      },
      { property: "og:title", content: "Rental vacancies & renter match · HALISIA AI" },
      {
        property: "og:description",
        content: "Consent-based rental matching with transparent reasons for every result.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RentalsPage,
});

type Draft = {
  personalization_enabled: boolean;
  budget_min: string;
  budget_max: string;
  counties: string;
  towns: string;
  bedrooms_min: string;
  commute_preference: string;
  schools_priority: number;
  security_priority: number;
  accessibility_needed: boolean;
  amenities: string[];
  commute_origin_label: string;
  commute_origin_lat: string;
  commute_origin_lng: string;
  max_commute_minutes: string;
};

const EMPTY: Draft = {
  personalization_enabled: false,
  budget_min: "",
  budget_max: "",
  counties: "",
  towns: "",
  bedrooms_min: "",
  commute_preference: "",
  schools_priority: 0,
  security_priority: 0,
  accessibility_needed: false,
  amenities: [],
  commute_origin_label: "",
  commute_origin_lat: "",
  commute_origin_lng: "",
  max_commute_minutes: "",
};

function toDraft(p: RenterPreferences | null): Draft {
  if (!p) return EMPTY;
  return {
    personalization_enabled: p.personalization_enabled,
    budget_min: p.budget_min != null ? String(p.budget_min) : "",
    budget_max: p.budget_max != null ? String(p.budget_max) : "",
    counties: p.counties.join(", "),
    towns: p.towns.join(", "),
    bedrooms_min: p.bedrooms_min != null ? String(p.bedrooms_min) : "",
    commute_preference: p.commute_preference ?? "",
    schools_priority: p.schools_priority,
    security_priority: p.security_priority,
    accessibility_needed: p.accessibility_needed,
    amenities: p.amenities,
    commute_origin_label: p.commute_origin_label ?? "",
    commute_origin_lat: p.commute_origin_lat != null ? String(p.commute_origin_lat) : "",
    commute_origin_lng: p.commute_origin_lng != null ? String(p.commute_origin_lng) : "",
    max_commute_minutes: p.max_commute_minutes != null ? String(p.max_commute_minutes) : "",
  };
}

function RentalsPage() {
  const qc = useQueryClient();
  const prefsQ = useQuery({ queryKey: ["renter-prefs"], queryFn: getMyRenterPreferences });
  const listQ = useQuery({ queryKey: ["rental-vacancies"], queryFn: listRentalVacancies });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [openPrefs, setOpenPrefs] = useState(false);
  const [answers, setAnswers] = useState<ClarifyAnswers>({});
  const geo = useMyLocation();

  useEffect(() => {
    if (prefsQ.data !== undefined) setDraft(toDraft(prefsQ.data));
  }, [prefsQ.data]);

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveRenterPreferences({
        personalization_enabled: d.personalization_enabled,
        budget_min: d.budget_min ? Number(d.budget_min) : null,
        budget_max: d.budget_max ? Number(d.budget_max) : null,
        counties: d.counties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        towns: d.towns
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        bedrooms_min: d.bedrooms_min ? Number(d.bedrooms_min) : null,
        commute_preference: d.commute_preference || null,
        schools_priority: d.schools_priority,
        security_priority: d.security_priority,
        accessibility_needed: d.accessibility_needed,
        amenities: d.amenities,
        commute_origin_label: d.commute_origin_label || null,
        commute_origin_lat: d.commute_origin_lat ? Number(d.commute_origin_lat) : null,
        commute_origin_lng: d.commute_origin_lng ? Number(d.commute_origin_lng) : null,
        max_commute_minutes: d.max_commute_minutes ? Number(d.max_commute_minutes) : null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["renter-prefs"] }),
  });

  const matches = useMemo(
    () => matchRentals(listQ.data ?? [], prefsQ.data ?? null),
    [listQ.data, prefsQ.data],
  );
  const on = prefsQ.data?.personalization_enabled ?? false;
  const clarifications = useMemo(() => renterClarifications(prefsQ.data ?? null), [prefsQ.data]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <header className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Rentals</div>
        <h1 className="text-3xl font-display font-semibold mt-1">
          Rental vacancies & renter match
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every vacancy lists rent, deposit, service charge, availability, furnishing, security,
          accessibility and transport. Matching only runs when you switch personalization on.
        </p>
      </header>

      {/* Consent banner */}
      <section className="glass rounded-2xl border border-white/10 p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium">Personalization is {on ? "on" : "off"}</div>
              <p className="text-[11px] text-muted-foreground max-w-xl">
                {on
                  ? "We rank vacancies using only the preferences you entered below, and explain every result. Turn it off at any time to see plain, newest-first vacancies."
                  : "Results are newest-first and not personalized. Turn personalization on to rank by your budget, area, bedrooms, commute, schools, security, accessibility and amenities."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = { ...draft, personalization_enabled: !on };
              setDraft(next);
              save.mutate(next);
            }}
            aria-pressed={on}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent"
          >
            {on ? (
              <ToggleRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ToggleLeft className="h-4 w-4" aria-hidden="true" />
            )}
            {on ? "Turn off personalization" : "Turn on personalization"}
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="mb-6">
        <button
          type="button"
          onClick={() => setOpenPrefs((v) => !v)}
          aria-expanded={openPrefs}
          className="text-xs text-accent hover:underline"
        >
          {openPrefs ? "Hide my match preferences" : "Improve my matches →"}
        </button>
        {openPrefs && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(draft);
            }}
            className="glass mt-3 grid gap-4 rounded-2xl border border-white/10 p-5"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Budget min (KES/mo)">
                <input
                  type="number"
                  min={0}
                  value={draft.budget_min}
                  onChange={(e) => set("budget_min", e.target.value)}
                  className="input"
                />
              </F>
              <F label="Budget max (KES/mo)">
                <input
                  type="number"
                  min={0}
                  value={draft.budget_max}
                  onChange={(e) => set("budget_max", e.target.value)}
                  className="input"
                />
              </F>
              <F label="Minimum bedrooms">
                <input
                  type="number"
                  min={0}
                  value={draft.bedrooms_min}
                  onChange={(e) => set("bedrooms_min", e.target.value)}
                  className="input"
                />
              </F>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Preferred counties" hint="Comma separated">
                <input
                  value={draft.counties}
                  onChange={(e) => set("counties", e.target.value)}
                  className="input"
                  placeholder="Nairobi, Kiambu"
                />
              </F>
              <F label="Preferred towns / estates" hint="Comma separated">
                <input
                  value={draft.towns}
                  onChange={(e) => set("towns", e.target.value)}
                  className="input"
                  placeholder="Kilimani, Ruaka"
                />
              </F>
            </div>
            <F label="Commute preference">
              <select
                value={draft.commute_preference}
                onChange={(e) => set("commute_preference", e.target.value)}
                className="input"
              >
                <option value="">— no preference —</option>
                {COMMUTE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </F>
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Commute origin" hint="Where you travel to most days">
                <input
                  value={draft.commute_origin_label}
                  onChange={(e) => set("commute_origin_label", e.target.value)}
                  className="input"
                  placeholder="Upper Hill office"
                />
              </F>
              <F label="Origin coordinates" hint="Used to estimate commute bands">
                <div className="flex gap-1.5">
                  <input
                    aria-label="Origin latitude"
                    value={draft.commute_origin_lat}
                    onChange={(e) => set("commute_origin_lat", e.target.value)}
                    className="input"
                    placeholder="-1.29"
                  />
                  <input
                    aria-label="Origin longitude"
                    value={draft.commute_origin_lng}
                    onChange={(e) => set("commute_origin_lng", e.target.value)}
                    className="input"
                    placeholder="36.82"
                  />
                  <button
                    type="button"
                    aria-label="Use my current location as commute origin"
                    onClick={async () => {
                      const loc = await geo.request();
                      if (loc)
                        setDraft((d) => ({
                          ...d,
                          commute_origin_lat: String(loc.lat),
                          commute_origin_lng: String(loc.lng),
                          commute_origin_label: d.commute_origin_label || "My current location",
                        }));
                    }}
                    disabled={geo.loading}
                    className="rounded-full border border-accent/40 bg-accent/10 px-2.5 text-accent disabled:opacity-60"
                  >
                    <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </F>
              <F label="Longest acceptable commute (min)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={draft.max_commute_minutes}
                  onChange={(e) => set("max_commute_minutes", e.target.value)}
                  className="input"
                />
              </F>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <F label={`Schools priority (${draft.schools_priority}/5)`}>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={draft.schools_priority}
                  onChange={(e) => set("schools_priority", Number(e.target.value))}
                  className="w-full"
                />
              </F>
              <F label={`Security priority (${draft.security_priority}/5)`}>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={draft.security_priority}
                  onChange={(e) => set("security_priority", Number(e.target.value))}
                  className="w-full"
                />
              </F>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.accessibility_needed}
                onChange={(e) => set("accessibility_needed", e.target.checked)}
              />
              I need step-free / accessible housing
            </label>
            <F label="Must-have amenities">
              <div className="flex flex-wrap gap-2">
                {RENTER_AMENITIES.map((a) => {
                  const active = draft.amenities.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        set(
                          "amenities",
                          active ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a],
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-accent bg-accent/20 text-accent"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </F>
            <ClarifyStep
              title="Before we rank"
              intro="Answer what you can — each answer is applied to your preferences so matches stay explainable."
              questions={clarifications}
              answers={answers}
              onChange={(next) => {
                setAnswers(next);
                const cap = next["commute_cap"];
                if (cap && /\d/.test(cap))
                  setDraft((d) => ({ ...d, max_commute_minutes: cap.replace(/\D/g, "") }));
                if (cap === "No limit") setDraft((d) => ({ ...d, max_commute_minutes: "" }));
                const origin = next["commute_origin"];
                if (origin === "Use my current location")
                  void geo.request().then((loc) => {
                    if (loc)
                      setDraft((d) => ({
                        ...d,
                        commute_origin_lat: String(loc.lat),
                        commute_origin_lng: String(loc.lng),
                        commute_origin_label: d.commute_origin_label || "My current location",
                      }));
                  });
                const counties = next["counties"];
                if (counties && counties !== "Anywhere in Kenya")
                  setDraft((d) => ({ ...d, counties: d.counties || counties }));
              }}
            />
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Save preferences
            </button>
          </form>
        )}
      </section>

      {/* Results */}
      <section>
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          {on ? "Matched vacancies" : "Latest vacancies"}
        </h2>
        {listQ.isLoading ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading vacancies…
          </div>
        ) : matches.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            No rental vacancies published yet.{" "}
            <Link to="/sell/new" className="text-accent hover:underline">
              List one
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-3">
            {matches.map(({ listing, score, reasons, gaps, commute }) => {
              const p = listing.property;
              const r = listing.rental;
              return (
                <li key={p.id} className="glass rounded-2xl border border-white/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/marketplace/$id"
                        params={{ id: p.id }}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {p.title}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {p.address ? `${p.address}, ` : ""}
                        {p.county ?? "Kenya"} · {r?.bedrooms ?? p.bedrooms ?? "—"} bed ·{" "}
                        {r?.bathrooms ?? p.bathrooms ?? "—"} bath ·{" "}
                        {r?.furnishing ?? "Furnishing not stated"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatRent(r, p.currency)}</div>
                      {on && (
                        <div className="text-[11px] text-accent font-numeric">{score}% match</div>
                      )}
                      {on && commute && (
                        <div
                          className="text-[10px] text-muted-foreground"
                          data-testid="commute-band"
                        >
                          {commute.band.label} · ~{commute.minutes} min by {commute.mode}
                        </div>
                      )}
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
                    <Detail k="Deposit" v={r?.deposit != null ? String(r.deposit) : "—"} />
                    <Detail
                      k="Service charge"
                      v={r?.service_charge != null ? String(r.service_charge) : "—"}
                    />
                    <Detail k="Available" v={r?.available_from ?? "—"} />
                    <Detail
                      k="Parking"
                      v={r?.parking_spaces != null ? String(r.parking_spaces) : "—"}
                    />
                    <Detail k="Utilities" v={(r?.utilities_included ?? []).join(", ") || "—"} />
                    <Detail k="Security" v={(r?.security_features ?? []).join(", ") || "—"} />
                    <Detail
                      k="Accessibility"
                      v={(r?.accessibility_features ?? []).join(", ") || "—"}
                    />
                    <Detail k="Transport" v={r?.public_transport ?? "—"} />
                  </dl>

                  {(r?.house_rules ||
                    r?.viewing_instructions ||
                    r?.contact_phone ||
                    r?.contact_email) && (
                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                      {r?.house_rules && (
                        <div>
                          <span className="text-foreground">House rules:</span> {r.house_rules}
                        </div>
                      )}
                      {r?.viewing_instructions && (
                        <div>
                          <span className="text-foreground">Viewing:</span> {r.viewing_instructions}
                        </div>
                      )}
                      {(r?.contact_phone || r?.contact_email) && (
                        <div>
                          <span className="text-foreground">Contact:</span>{" "}
                          {[r?.contact_name, r?.contact_phone, r?.contact_email]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <AvailabilityCalendar
                      availability={parseAvailability(r?.availability_windows)}
                      viewings={parseViewings(r?.viewing_windows)}
                      fallbackFrom={r?.available_from ?? null}
                    />
                  </div>

                  <div className="mt-3">
                    <ViewingBooking propertyId={listing.property.id} mode="renter" />
                  </div>

                  <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <summary className="cursor-pointer text-[11px] text-accent inline-flex items-center gap-1">
                      <Info className="h-3 w-3" aria-hidden="true" /> Why am I seeing this?
                    </summary>
                    <ul className="mt-1.5 list-disc pl-4 text-[11px] text-muted-foreground">
                      {reasons.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    {gaps.length > 0 && (
                      <>
                        <div className="mt-2 text-[10px] uppercase tracking-widest text-amber-200">
                          Gaps
                        </div>
                        <ul className="list-disc pl-4 text-[11px] text-muted-foreground">
                          {gaps.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{k}</dt>
      <dd className="text-foreground/90">{v}</dd>
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}
