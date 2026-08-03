import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import {
  PRO_CATEGORIES,
  PRO_CATEGORY_LABELS,
  averageRating,
  listMyProProfiles,
  listRequestsForMe,
  listReviews,
  saveProProfile,
  setRequestStatus,
  verificationLabel,
  type ProCategory,
} from "@/lib/professionals";

export const Route = createFileRoute("/_authenticated/pro-profile")({
  head: () => ({
    meta: [
      { title: "Professional dashboard · HALISIA AI" },
      {
        name: "description",
        content:
          "Manage your Halisia Connections service profile, project leads, reviews and availability.",
      },
      { property: "og:title", content: "Professional dashboard · HALISIA AI" },
      {
        property: "og:description",
        content: "Your service profile, leads, reviews and availability in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProDashboard,
});

function ProDashboard() {
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["my-pro-profiles"], queryFn: listMyProProfiles });
  const requests = useQuery({ queryKey: ["pro-requests-mine"], queryFn: listRequestsForMe });
  const first = profiles.data?.[0];

  const [form, setForm] = useState({
    display_name: "",
    organisation: "",
    category: "architect" as ProCategory,
    bio: "",
    county: "",
    town: "",
    years_experience: "",
    qualifications: "",
    registration_body: "",
    registration_number: "",
    availability: "",
    rate_note: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    published: false,
  });

  useEffect(() => {
    if (!first) return;
    setForm({
      display_name: first.display_name,
      organisation: first.organisation ?? "",
      category: first.category,
      bio: first.bio ?? "",
      county: first.county ?? "",
      town: first.town ?? "",
      years_experience: first.years_experience?.toString() ?? "",
      qualifications: first.qualifications.join(", "),
      registration_body: first.registration_body ?? "",
      registration_number: first.registration_number ?? "",
      availability: first.availability ?? "",
      rate_note: first.rate_note ?? "",
      contact_email: first.contact_email ?? "",
      contact_phone: first.contact_phone ?? "",
      website: first.website ?? "",
      published: first.published,
    });
  }, [first]);

  const save = useMutation({
    mutationFn: () =>
      saveProProfile({
        display_name: form.display_name,
        category: form.category,
        organisation: form.organisation || null,
        bio: form.bio || null,
        county: form.county || null,
        town: form.town || null,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        qualifications: form.qualifications
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        registration_body: form.registration_body || null,
        registration_number: form.registration_number || null,
        availability: form.availability || null,
        rate_note: form.rate_note || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website: form.website || null,
        published: form.published,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-pro-profiles"] });
      toast.success("Service profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: string }) => setRequestStatus(id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-requests-mine"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reviews = useQuery({
    queryKey: ["pro-reviews", first?.id ?? "none"],
    queryFn: () => (first ? listReviews(first.id) : Promise.resolve([])),
    enabled: Boolean(first),
  });
  const avg = averageRating(reviews.data ?? []);
  const leads = requests.data ?? [];

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-5xl mx-auto">
      <Link
        to="/dashboard"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          Halisia Connections
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-display font-semibold">
          <Briefcase className="h-6 w-6 text-accent" aria-hidden="true" /> Professional dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your service profile, project leads, reviews and availability.
        </p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Project requests" value={leads.length} />
        <Stat label="Open leads" value={leads.filter((l) => l.status === "new").length} />
        <Stat label="Average rating" value={avg != null ? `${avg}/5` : "—"} />
      </section>

      {first && (
        <div className="glass mb-6 rounded-2xl border border-white/10 p-3 text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground">{verificationLabel(first).label}</span> —{" "}
          {verificationLabel(first).note}
        </div>
      )}

      <section className="mb-10" aria-label="Service profile">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          Service profile
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="glass grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2"
        >
          <Text
            label="Name or organisation"
            required
            value={form.display_name}
            onChange={(v) => setForm({ ...form, display_name: v })}
          />
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Service category
            </span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ProCategory })}
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm"
            >
              {PRO_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <Text
            label="Trading name"
            value={form.organisation}
            onChange={(v) => setForm({ ...form, organisation: v })}
          />
          <Text
            label="Years of experience"
            value={form.years_experience}
            onChange={(v) => setForm({ ...form, years_experience: v })}
          />
          <Text
            label="County"
            value={form.county}
            onChange={(v) => setForm({ ...form, county: v })}
          />
          <Text label="Town" value={form.town} onChange={(v) => setForm({ ...form, town: v })} />
          <Text
            label="Qualifications (comma separated)"
            value={form.qualifications}
            onChange={(v) => setForm({ ...form, qualifications: v })}
          />
          <Text
            label="Availability"
            value={form.availability}
            onChange={(v) => setForm({ ...form, availability: v })}
          />
          <Text
            label="Registration body"
            value={form.registration_body}
            onChange={(v) => setForm({ ...form, registration_body: v })}
          />
          <Text
            label="Registration number"
            value={form.registration_number}
            onChange={(v) => setForm({ ...form, registration_number: v })}
          />
          <Text
            label="Contact email"
            value={form.contact_email}
            onChange={(v) => setForm({ ...form, contact_email: v })}
          />
          <Text
            label="Contact phone"
            value={form.contact_phone}
            onChange={(v) => setForm({ ...form, contact_phone: v })}
          />
          <Text
            label="Website"
            value={form.website}
            onChange={(v) => setForm({ ...form, website: v })}
          />
          <Text
            label="Indicative rates"
            value={form.rate_note}
            onChange={(v) => setForm({ ...form, rate_note: v })}
          />
          <label className="block sm:col-span-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              About your practice
            </span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
              className="h-4 w-4 accent-[oklch(0.68_0.19_249)]"
            />
            Publish my profile in Halisia Connections
          </label>
          <p className="text-[11px] text-muted-foreground/80 sm:col-span-2">
            Registration details you enter are shown as self-declared and unconfirmed until Halisia
            verifies them. We never present unverified registration as verified.
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              Save service profile
            </button>
          </div>
        </form>
      </section>

      <section className="mb-10" aria-label="Project requests">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          Leads &amp; project requests
        </h2>
        {leads.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            No project requests yet. Publishing your profile makes you discoverable in Connections.
          </div>
        ) : (
          <ul className="grid gap-3">
            {leads.map((l) => (
              <li key={l.id} className="glass rounded-2xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()} {l.county ? `· ${l.county}` : ""}
                    </div>
                    <p className="mt-1 text-sm">{l.project_brief}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {l.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["contacted", "quoted", "won", "declined"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => status.mutate({ id: l.id, s })}
                      className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] hover:text-accent"
                    >
                      Mark {s}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Reviews">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">Reviews</h2>
        {(reviews.data ?? []).length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-6 text-sm text-muted-foreground">
            No reviews yet.
          </div>
        ) : (
          <ul className="grid gap-2">
            {(reviews.data ?? []).map((r) => (
              <li key={r.id} className="glass rounded-2xl border border-white/10 p-3">
                <div className="flex items-center gap-1 text-gold text-[11px]">
                  <Star className="h-3 w-3 fill-current" aria-hidden="true" /> {r.rating}/5
                </div>
                {r.comment && <p className="mt-1 text-[12px] text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-display font-semibold">{value}</div>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </label>
  );
}
