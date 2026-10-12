import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScoutHub } from "@/components/halisia/scout-hub";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  previewQuote,
  SCOUT_TASKS,
  type AccessLevel,
  type ChecklistChoice,
} from "@/lib/scout-pricing";

type Search = {
  job?: string;
  ref?: string;
  county?: string;
  src?: string;
  lat?: number;
  lng?: number;
};

/**
 * A coordinate from the URL, or undefined.
 *
 * `!isNaN(Number(""))` is true, so an empty parameter — `?lat=&lng=` — used to
 * become the number 0 and prefill the form with a point in the Gulf of Guinea
 * that the buyer never typed. The submit guard caught it, but only after they
 * had seen two populated fields presented as their plot. An empty string is a
 * missing coordinate, not the origin.
 */
const coord = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const Route = createFileRoute("/_authenticated/scout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    job: typeof s.job === "string" ? s.job : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
    county: typeof s.county === "string" ? s.county : undefined,
    src: typeof s.src === "string" ? s.src : undefined,
    lat: coord(s.lat),
    lng: coord(s.lng),
  }),
  head: () => ({
    meta: [
      { title: "Send a Scout — HALISIA" },
      {
        name: "description",
        content:
          "Book an approved field scout to observe a plot in person. Field observation, not a survey.",
      },
      { property: "og:title", content: "Send a Scout — HALISIA" },
      {
        property: "og:description",
        content: "Book an approved field scout to observe a plot in person.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoutPage,
});

const DRAFT_PREFIX = "halisia-scout-draft:";

function ScoutPage() {
  const s = Route.useSearch();
  const [titleReference, setTitleReference] = useState(s.ref ?? "");
  const [county, setCounty] = useState(s.county ?? "");
  const [uid, setUid] = useState<string | null>(null);
  const DRAFT_KEY = DRAFT_PREFIX + (uid ?? "signed-out");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, ChecklistChoice>>(
    {},
  );
  const [access, setAccess] = useState<AccessLevel>("easy");
  const [travel, setTravel] = useState(0);
  const [lat, setLat] = useState(s.lat?.toString() ?? "");
  const [lng, setLng] = useState(s.lng?.toString() ?? "");
  const [instructions, setInstructions] = useState("");
  const [custom, setCustom] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Preserve form progress on weak connections (server remains the record).
  useEffect(() => {
    if (!uid) return;
    let d: string | null = null;
    try {
      d = localStorage.getItem(DRAFT_KEY);
    } catch {
      /* private mode */
    }
    if (d) {
      try {
        const v = JSON.parse(d);
        setChecklist(v.checklist ?? {});
        setInstructions(v.instructions ?? "");
        setCustom(v.custom ?? "");
      } catch {
        /* ignore */
      }
    }
    setDraftLoaded(true);
  }, [uid, DRAFT_KEY]);
  useEffect(() => {
    if (!uid || !draftLoaded) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ checklist, instructions, custom }),
      );
    } catch {
      /* optional draft */
    }
  }, [uid, draftLoaded, DRAFT_KEY, checklist, instructions, custom]);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    setUid(u.user?.id ?? null);
    if (u.user) {
      const { data: a } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "administrator",
      });
      setIsAdmin(Boolean(a));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const catalogQ = useQuery({
    queryKey: ["scout-catalog"],
    queryFn: async () => {
      const r = await supabase
        .from("scout_price_catalog")
        .select("*")
        .order("sort");
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    },
  });
  const q = previewQuote(checklist, access, travel, catalogQ.data);
  const catalog = catalogQ.data;
  const taskOptions = SCOUT_TASKS.filter(
    (t) => !catalog || catalog.some((c) => c.code === t.code && c.active),
  ).map((t) => ({
    ...t,
    kes: catalog?.find((c) => c.code === t.code)?.amount_kes ?? t.kes,
  }));
  const hasCoords = lat !== "" && lng !== "";
  /**
   * Provenance survives only while the coordinates are the ones that arrived.
   *
   * `location_source` is printed verbatim into the scout's brief and into the
   * request record, so it has to describe how THESE numbers were obtained. The
   * approximate_geocode branch always re-checked that; the manual_pin branch
   * did not, so a buyer who arrived from the title-deed page with a pin they
   * had placed, then typed different numbers into the two fields, still filed
   * the request as "manual_pin". A pin somebody dropped on their own plot and
   * a figure typed afterwards are different kinds of evidence, and the whole
   * product rests on not confusing the two. Edit either field and the claim
   * drops to explicit_coordinates, which is what it then is.
   */
  const untouched = lat === String(s.lat ?? "") && lng === String(s.lng ?? "");
  const locSource = !hasCoords
    ? "directions_only"
    : untouched && s.src === "manual_pin"
      ? "manual_pin"
      : untouched && s.src === "approximate_geocode"
        ? "approximate_geocode"
        : "explicit_coordinates";

  const submit = async () => {
    if (!county.trim()) return toast.error("Enter the service county");
    if ((lat === "") !== (lng === ""))
      return toast.error("Enter both latitude and longitude");
    if (
      hasCoords &&
      (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
    )
      return toast.error("Enter valid coordinates");
    if (
      hasCoords &&
      (Number(lat) < -5 ||
        Number(lat) > 5.5 ||
        Number(lng) < 33.5 ||
        Number(lng) > 42.5)
    )
      return toast.error("Coordinates are outside Kenya");
    if (!hasCoords && !instructions.trim())
      return toast.error("Add directions or site coordinates");
    if (!Number.isFinite(travel) || travel < 0 || travel > 100000)
      return toast.error("Enter valid travel costs");
    if (!catalogQ.data) return toast.error("Wait for current pricing to load");
    setBusy(true);
    const { error } = await supabase.rpc("scout_create_request", {
      p_title_reference: titleReference,
      p_county: county,
      p_location_source: locSource,
      p_lat: hasCoords ? Number(lat) : (null as unknown as number),
      p_lng: hasCoords ? Number(lng) : (null as unknown as number),
      p_location_confirmed: confirmed,
      p_instructions: instructions,
      p_custom_concern: custom,
      p_checklist: Object.fromEntries(
        taskOptions.map((t) => [t.code, checklist[t.code] ?? "not"]),
      ),
      p_access_level: access,
      p_travel_kes: travel,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* optional draft */
    }
    toast.success("Request created with a server-calculated quote");
    void load();
  };

  const kes = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-24">
      <Link to="/contributions" className="text-xs text-muted-foreground">
        ← Contributor dashboard
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Send a Scout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A person visits and records what they see and hear. This is field
        observation, not a survey, title search or ownership verification.
      </p>

      <section className="glass mt-6 grid gap-4 rounded-2xl p-4">
        <div className="text-xs">
          <label className="block text-sm">
            Title / parcel reference
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-card px-3 py-3"
              value={titleReference}
              onChange={(e) => setTitleReference(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            County
            <input
              required
              placeholder="e.g. Kajiado"
              className="mt-1 w-full rounded-xl border border-white/15 bg-card px-3 py-3"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
          </label>
        </div>
        {s.src === "approximate_geocode" && (
          <p className="text-xs text-amber-glow">
            These coordinates are an approximate area match, not the parcel.
            Correct them or add directions.
          </p>
        )}
        {hasCoords && !untouched && s.src && (
          <p className="text-xs text-muted-foreground">
            You changed the coordinates, so this request is filed as
            coordinates you entered rather than as the point you arrived with.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Latitude
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="text-xs">
            Longitude
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
        <label className="text-xs">
          Directions / instructions for the scout
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-2"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Checklist (suggested pilot pricing)
          </legend>
          <div className="text-xs">
            Base visit — 8 photos + 1 short video · {kes(q.baseKes)}
          </div>
          {taskOptions.map((t) => (
            <div
              key={t.code}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-sm">
                {t.label} · {kes(t.kes)}
              </span>
              <select
                aria-label={t.label}
                className="min-h-12 rounded-xl border border-white/15 bg-transparent px-2"
                value={checklist[t.code] ?? "not"}
                onChange={(e) =>
                  setChecklist({
                    ...checklist,
                    [t.code]: e.target.value as ChecklistChoice,
                  })
                }
              >
                <option value="check">Check this</option>
                <option value="unsure">Unsure — investigate</option>
                <option value="not">Not requested</option>
              </select>
            </div>
          ))}
          {(checklist.custom ?? "not") !== "not" && (
            <input
              placeholder="Describe your concern"
              className="rounded-xl border border-white/15 bg-transparent px-3 py-3"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Access (estimate, scout confirms)
            <select
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-transparent px-2"
              value={access}
              onChange={(e) => setAccess(e.target.value as AccessLevel)}
            >
              <option value="easy">
                Easy (
                {kes(
                  catalog?.find((c) => c.code === "access_easy")?.amount_kes ??
                    0,
                )}
                )
              </option>
              <option value="difficult">
                Difficult (
                {kes(
                  catalog?.find((c) => c.code === "access_difficult")
                    ?.amount_kes ?? 500,
                )}
                )
              </option>
              <option value="remote">
                Remote (
                {kes(
                  catalog?.find((c) => c.code === "access_remote")
                    ?.amount_kes ?? 1500,
                )}
                )
              </option>
            </select>
          </label>
          <label className="text-xs">
            Travel at cost (estimate, KES)
            <input
              type="number"
              min={0}
              className="mt-1 min-h-12 w-full rounded-xl border border-white/15 bg-transparent px-3"
              value={travel}
              onChange={(e) => setTravel(Number(e.target.value))}
            />
          </label>
        </div>

        {catalogQ.error && (
          /* previewQuote falls back to the constants in scout-pricing.ts when
             the catalogue will not load, so every figure below still renders.
             Without this line the buyer reads stale defaults as their quote. */
          <p className="rounded-xl border border-amber-glow/40 px-3 py-2 text-xs text-amber-glow">
            These figures are the built-in pilot defaults, not the current
            catalogue, which did not load. They are not your quote.
          </p>
        )}
        <dl className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-3 text-sm">
          <dt>Scout work (base + activities)</dt>
          <dd className="text-right">{kes(q.scoutWorkKes)}</dd>
          <dt>Travel + access (estimates)</dt>
          <dd className="text-right">{kes(q.travelKes + q.accessKes)}</dd>
          <dt>Scout earnings</dt>
          <dd className="text-right">{kes(q.scoutEarningsKes)}</dd>
          <dt>HALISIA fee ({q.feePct}% of scout work)</dt>
          <dd className="text-right">{kes(q.platformFeeKes)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{kes(q.totalKes)}</dd>
        </dl>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm this is the place I want visited. I understand it is not a
          verified parcel location.
        </label>
        <button
          disabled={
            busy || !confirmed || catalogQ.isPending || !!catalogQ.error
          }
          onClick={submit}
          className="min-h-12 rounded-full bg-primary px-4 text-primary-foreground disabled:opacity-50"
        >
          Request quote
        </button>
        <p className="text-[11px] text-muted-foreground">
          Current prices are suggested pilot prices. Automatic checkout and
          payouts are not configured. Payment collection stays disabled until
          HALISIA configures verified payment instructions; an administrator
          verifies actual receipts before assignment.
        </p>
      </section>

      {catalogQ.error && (
        <p role="alert">
          Pricing could not load.{" "}
          <button onClick={() => void catalogQ.refetch()}>Retry</button>
        </p>
      )}
      {uid && <ScoutHub uid={uid} isAdmin={isAdmin} initialJob={s.job} />}
    </main>
  );
}
