import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  Building2,
  CalendarClock,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import {
  PRO_CATEGORIES,
  PRO_CATEGORY_LABELS,
  PROJECT_TYPES,
  averageRating,
  inferProjectType,
  listProfessionals,
  listReviews,
  parseAvailability,
  publicRegistration,
  recommendTeam,
  requestProfessional,
  submitReview,
  upcomingWindows,
  verificationLabel,
  type ProCategory,
  type ProProfile,
  type ProjectType,
} from "@/lib/professionals";
import { saveItem } from "@/lib/saved-items";
import { useAuth } from "@/hooks/use-auth";
import { listMyRoles, PROFESSIONAL_ROLES, ROLE_LABELS } from "@/lib/roles";
import { KenyaMotif, SegmentedTabs } from "@/components/halisia/ds";
import { toast } from "sonner";

export const Route = createFileRoute("/connections")({
  head: () => ({
    meta: [
      { title: "Halisia Connections · Find verified property professionals in Kenya" },
      {
        name: "description",
        content:
          "Find architects, engineers, surveyors, valuers, lawyers and contractors across Kenya, and get an AI-matched project team for your land.",
      },
      { property: "og:title", content: "Halisia Connections — Kenya property professionals" },
      {
        property: "og:description",
        content:
          "Search professional profiles by service, county and experience, then request a project team matched to your land.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const [category, setCategory] = useState<ProCategory | "all">("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<ProProfile | null>(null);
  const { user } = useAuth();
  const [section, setSection] = useState<"match" | "directory" | "workspace">("match");

  const myRoles = useQuery({
    queryKey: ["my-roles"],
    queryFn: listMyRoles,
    enabled: Boolean(user),
  });
  const proRoles = (myRoles.data ?? []).filter((r) => PROFESSIONAL_ROLES.includes(r));
  const isProfessional = proRoles.length > 0;

  const pros = useQuery({
    queryKey: ["pro-directory", category],
    queryFn: () => listProfessionals({ category }),
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = pros.data ?? [];
    if (!term) return list;
    return list.filter((r) =>
      [r.display_name, r.organisation, r.bio, r.town, r.county]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [pros.data, q]);

  return (
    <main className="relative min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
      <KenyaMotif className="fixed inset-0 -z-10 opacity-[0.5]" />
      <nav aria-label="Breadcrumb" className="mb-3 text-[11px] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-accent">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className={active ? "" : "text-foreground"}>
            {active ? (
              <button type="button" onClick={() => setActive(null)} className="hover:text-accent">
                Connections
              </button>
            ) : (
              "Connections"
            )}
          </li>
          {active && (
            <>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{active.display_name}</li>
            </>
          )}
        </ol>
      </nav>
      <header className="mb-8 max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          Halisia Connections
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-semibold mt-2 flex items-center gap-2">
          <Users className="h-7 w-7 text-accent" aria-hidden="true" /> The people who build it
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Architects, engineers, surveyors, valuers, lawyers, contractors and finance partners
          working across Kenya. Tell us the project and Halisia proposes the team it needs.
        </p>
      </header>

      <SegmentedTabs
        className="mb-6"
        value={section}
        onValueChange={(v) => setSection(v as typeof section)}
        label="Connections sections"
        items={[
          { value: "match", label: "Project matching" },
          { value: "directory", label: "Directory" },
          ...(isProfessional
            ? [{ value: "workspace" as const, label: "Professional workspace" }]
            : []),
        ]}
      />

      {section === "match" && (
        <ProjectMatcher
          onPickCategory={(c) => {
            setCategory(c);
            setSection("directory");
          }}
        />
      )}

      {section === "workspace" && isProfessional && (
        <section
          className="glass rounded-3xl border border-accent/20 p-5"
          aria-label="Professional workspace"
          data-testid="pro-workspace"
        >
          <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
            Professional workspace
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold">
            Modules for your registered disciplines
          </h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {proRoles.map((r) => (
              <li
                key={r}
                className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                {ROLE_LABELS[r]}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              to="/pro-profile"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
            >
              <div className="text-sm font-medium">My practice profile</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Publish your listing, upload evidence and manage verification.
              </p>
            </Link>
            <Link
              to="/pros"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
            >
              <div className="text-sm font-medium">Incoming project requests</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Review briefs, confirm viewing windows and respond to clients.
              </p>
            </Link>
            <Link
              to="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
            >
              <div className="text-sm font-medium">Professional dashboard</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Verification status, published profiles and request pipeline.
              </p>
            </Link>
          </div>
        </section>
      )}

      {!isProfessional && section !== "workspace" && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Work in one of these disciplines?{" "}
          <Link to="/account" className="text-accent hover:underline">
            Add a professional role
          </Link>{" "}
          to unlock the professional workspace and listing tools.
        </p>
      )}

      <section
        className={`mt-10 ${section === "directory" ? "" : "hidden"}`}
        aria-label="Professional directory"
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="relative flex-1 min-w-[220px]">
            <span className="sr-only">Search professionals</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, firm or town"
              className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProCategory | "all")}
            aria-label="Filter by service"
            className="h-10 rounded-full border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <option value="all">All services</option>
            {PRO_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {pros.isLoading ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="glass h-44 animate-pulse rounded-2xl border border-white/10" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="glass rounded-2xl border border-white/10 p-8 text-center">
            <Building2 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              No published profiles match this filter yet.
            </p>
            <Link
              to="/pro-profile"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              List your practice
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pro-directory">
            {rows.map((p) => (
              <li key={p.id}>
                <ProCard pro={p} onOpen={() => setActive(p)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-[11px] text-muted-foreground/80">
        Halisia does not confirm professional registration unless a profile is explicitly marked
        verified. Always confirm licence status with the relevant regulator before appointing.
      </p>

      {active && <ProDetail pro={active} onClose={() => setActive(null)} />}
    </main>
  );
}

function ProjectMatcher({ onPickCategory }: { onPickCategory: (c: ProCategory) => void }) {
  const { user } = useAuth();
  const [brief, setBrief] = useState("");
  const [type, setType] = useState<ProjectType | "auto">("auto");
  const [result, setResult] = useState<ProjectType | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [essentialOnly, setEssentialOnly] = useState(false);
  const [county, setCounty] = useState("");

  const resolved = result ?? null;
  const fullTeam = resolved ? recommendTeam(resolved) : [];
  const stages = Array.from(new Set(fullTeam.map((t) => t.stage)));
  const team = fullTeam.filter(
    (t) => (stageFilter === "all" || t.stage === stageFilter) && (!essentialOnly || t.essential),
  );

  const saveMatch = useMutation({
    mutationFn: async () => {
      if (!resolved) throw new Error("Match your team first");
      const label = `${PROJECT_TYPES.find((p) => p.value === resolved)?.label}${
        county.trim() ? ` · ${county.trim()}` : ""
      }`;
      return saveItem({
        kind: "match",
        ref: `${resolved}:${county.trim().toLowerCase() || "kenya"}`,
        label,
        note: JSON.stringify({
          projectType: resolved,
          brief: brief.trim() || null,
          county: county.trim() || null,
          roles: fullTeam.map((t) => ({
            category: t.category,
            stage: t.stage,
            essential: t.essential,
          })),
        }),
      });
    },
    onSuccess: () =>
      toast.success("Match saved", { description: "Find it under Saved on your dashboard." }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section
      className="glass rounded-3xl border border-accent/20 p-5 md:p-6"
      aria-label="Project matching"
      data-testid="project-matcher"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-accent">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Project matching
      </div>
      <h2 className="mt-2 text-xl font-display font-semibold">
        Describe the project. Get the team it needs.
      </h2>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setResult(type === "auto" ? inferProjectType(brief) : type);
        }}
      >
        <label className="md:col-span-1">
          <span className="sr-only">Project brief</span>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="I have land in Machakos and want to develop rental apartments."
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </label>
        <label>
          <span className="sr-only">County</span>
          <input
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder="County (optional)"
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60 md:w-40"
          />
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ProjectType | "auto")}
          aria-label="Project type"
          className="h-11 rounded-full border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <option value="auto">Detect from my brief</option>
          {PROJECT_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-xs font-medium text-primary-foreground"
        >
          Match my team
        </button>
      </form>

      {resolved && (
        <div className="mt-5" data-testid="match-result">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Suggested team · {PROJECT_TYPES.find((p) => p.value === resolved)?.label}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                aria-label="Filter roles by stage"
                className="h-8 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px]"
              >
                <option value="all">All stages</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={essentialOnly}
                  onChange={(e) => setEssentialOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[oklch(0.78_0.16_210)]"
                />
                Essential roles only
              </label>
              <button
                type="button"
                data-testid="save-match"
                disabled={saveMatch.isPending || !user}
                onClick={() => saveMatch.mutate()}
                title={user ? "Save this team to your dashboard" : "Sign in to save this match"}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-accent disabled:opacity-50"
              >
                {saveMatch.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                )}
                Save match
              </button>
            </div>
          </div>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {team.map((t, i) => (
              <li
                key={t.category}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {String(i + 1).padStart(2, "0")} · {PRO_CATEGORY_LABELS[t.category]}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      t.essential
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-white/15 text-muted-foreground"
                    }`}
                  >
                    {t.essential ? "Essential" : "Optional"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t.why}</p>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Match confidence</span>
                    <span className="tabular-nums">{t.essential ? 88 : 64}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${t.essential ? 88 : 64}%` }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                    {t.stage}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPickCategory(t.category)}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Browse {PRO_CATEGORY_LABELS[t.category].toLowerCase()}s →
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground/80">
            Indicative sequencing for planning purposes. County requirements vary — confirm the
            statutory approvals that apply to your parcel.
          </p>
        </div>
      )}
    </section>
  );
}

function VerificationChip({ pro }: { pro: ProProfile }) {
  const v = verificationLabel(pro);
  const tone =
    v.tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : v.tone === "amber"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : "border-white/15 bg-white/5 text-muted-foreground";
  const Icon = v.tone === "emerald" ? BadgeCheck : ShieldAlert;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${tone}`}
      title={v.note}
    >
      <Icon className="h-3 w-3" aria-hidden="true" /> {v.label}
    </span>
  );
}

function ProCard({ pro, onOpen }: { pro: ProProfile; onOpen: () => void }) {
  const reviews = useQuery({
    queryKey: ["pro-reviews", pro.id],
    queryFn: () => listReviews(pro.id),
  });
  const avg = averageRating(reviews.data ?? []);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="pro-card"
      className="glass h-full w-full rounded-2xl border border-white/10 p-4 text-left transition hover:border-accent/40 hover:bg-white/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{pro.display_name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {pro.organisation ?? PRO_CATEGORY_LABELS[pro.category]}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
          {PRO_CATEGORY_LABELS[pro.category]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
        {pro.bio ?? "No description supplied yet."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {(pro.town || pro.county) && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {[pro.town, pro.county].filter(Boolean).join(", ")}
          </span>
        )}
        {pro.years_experience != null && (
          <span className="inline-flex items-center gap-1">
            <Award className="h-3 w-3" aria-hidden="true" /> {pro.years_experience} yrs
          </span>
        )}
        {avg != null && (
          <span className="inline-flex items-center gap-1 text-gold">
            <Star className="h-3 w-3 fill-current" aria-hidden="true" /> {avg}
          </span>
        )}
      </div>
      <div className="mt-3">
        <VerificationChip pro={pro} />
      </div>
    </button>
  );
}

function ProDetail({ pro, onClose }: { pro: ProProfile; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reviews = useQuery({
    queryKey: ["pro-reviews", pro.id],
    queryFn: () => listReviews(pro.id),
  });
  const [brief, setBrief] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [slot, setSlot] = useState("");
  const v = verificationLabel(pro);
  const windows = useMemo(() => upcomingWindows(parseAvailability(pro)), [pro]);
  const reg = publicRegistration(pro);
  const portfolio = Array.isArray(pro.portfolio)
    ? (pro.portfolio as Array<Record<string, unknown>>)
    : [];

  const contact = useMutation({
    mutationFn: () => {
      const picked = windows.find((w) => w.start.toISOString() === slot);
      return requestProfessional({
        professional_id: pro.id,
        project_brief: brief,
        preferred_start: picked ? picked.start.toISOString() : null,
        preferred_end: picked ? picked.end.toISOString() : null,
      });
    },
    onSuccess: () => {
      setBrief("");
      setSlot("");
      toast.success("Contact request sent", {
        description: slot
          ? `${pro.display_name} will confirm your requested time window.`
          : `${pro.display_name} will see your brief in their professional dashboard.`,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: () => submitReview({ professional_id: pro.id, rating, comment }),
    onSuccess: () => {
      setComment("");
      void qc.invalidateQueries({ queryKey: ["pro-reviews", pro.id] });
      toast.success("Review saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${pro.display_name} profile`}
    >
      <div className="glass-strong max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-display font-semibold">{pro.display_name}</h2>
            <div className="text-xs text-muted-foreground">
              {[
                pro.organisation,
                PRO_CATEGORY_LABELS[pro.category],
                [pro.town, pro.county].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerificationChip pro={pro} />
          {pro.years_experience != null && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              {pro.years_experience} years experience
            </span>
          )}
          {pro.availability && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <CalendarClock className="h-3 w-3" aria-hidden="true" /> {pro.availability}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{v.note}</p>

        {pro.bio && <p className="mt-4 text-sm leading-relaxed text-foreground/90">{pro.bio}</p>}

        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <Field label="Qualifications" value={pro.qualifications.join(", ") || "Not supplied"} />
          <Field
            label="Registration"
            value={
              reg.body
                ? reg.hidden
                  ? `${reg.body} · number hidden until verified`
                  : `${reg.body}${reg.number ? ` · ${reg.number}` : ""}`
                : "Not supplied"
            }
          />
          <Field
            label="Service area"
            value={pro.service_counties.join(", ") || pro.county || "Kenya"}
          />
          <Field label="Indicative rates" value={pro.rate_note ?? "On request"} />
        </dl>

        {portfolio.length > 0 && (
          <section className="mt-5">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Portfolio
            </h3>
            <ul className="mt-2 grid gap-2">
              {portfolio.map((item, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[12px]"
                >
                  <span className="font-medium">{String(item.title ?? "Project")}</span>
                  {item.summary != null && (
                    <span className="text-muted-foreground"> — {String(item.summary)}</span>
                  )}
                  {typeof item.url === "string" && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ml-1 inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Reviews{" "}
            {averageRating(reviews.data ?? []) != null &&
              `· ${averageRating(reviews.data ?? [])}/5`}
          </h3>
          {(reviews.data ?? []).length === 0 ? (
            <p className="mt-1 text-[12px] text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {(reviews.data ?? []).map((r) => (
                <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="text-[11px] text-gold">{"★".repeat(r.rating)}</div>
                  {r.comment && (
                    <p className="mt-1 text-[12px] text-muted-foreground">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {user ? (
          <div className="mt-5 grid gap-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                contact.mutate();
              }}
              className="rounded-2xl border border-accent/25 bg-accent/5 p-3"
            >
              <label
                className="text-[10px] uppercase tracking-widest text-accent"
                htmlFor="pro-brief"
              >
                Request this professional
              </label>
              <textarea
                id="pro-brief"
                required
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="Describe the site, the work and your timeline."
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <div className="mt-2">
                <label
                  htmlFor="pro-slot"
                  className="text-[10px] uppercase tracking-widest text-muted-foreground"
                >
                  Request a time window
                </label>
                {windows.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    This provider hasn't published availability yet — send the brief and they will
                    propose a time.
                  </p>
                ) : (
                  <select
                    id="pro-slot"
                    data-testid="pro-slot"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <option value="">No preference</option>
                    {windows.map((w) => (
                      <option key={w.start.toISOString()} value={w.start.toISOString()}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={contact.isPending}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {contact.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Send contact request
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                review.mutate();
              }}
              className="rounded-2xl border border-white/10 p-3"
            >
              <div className="flex items-center gap-2">
                <label
                  className="text-[10px] uppercase tracking-widest text-muted-foreground"
                  htmlFor="pro-rating"
                >
                  Leave a review
                </label>
                <select
                  id="pro-rating"
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="h-8 rounded-full border border-white/10 bg-white/5 px-2 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="How was the work?"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              />
              <button
                type="submit"
                disabled={review.isPending}
                className="mt-2 rounded-full border border-white/15 px-4 py-1.5 text-xs hover:bg-white/10 disabled:opacity-60"
              >
                Submit review
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[12px] text-muted-foreground">
            <Link to="/auth" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to send a contact request or leave a review.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[12px]">{value}</dd>
    </div>
  );
}
