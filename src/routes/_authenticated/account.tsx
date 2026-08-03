import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  ROLE_CATALOG,
  addRole,
  getMyProfile,
  listMyRoles,
  removeRole,
  upsertMyProfile,
  type AppRole,
} from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account & roles · HALISIA AI" },
      {
        name: "description",
        content:
          "Manage your Halisia account types, profile details, news preferences and alert settings.",
      },
      { property: "og:title", content: "Account & roles · HALISIA AI" },
      {
        property: "og:description",
        content: "Choose the roles that shape your Halisia dashboard.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

const GROUPS = ["General", "Owning & selling", "Professional", "Institutional"] as const;

function AccountPage() {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: listMyRoles });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const [form, setForm] = useState({
    display_name: "",
    headline: "",
    county: "",
    phone: "",
    news_topics: "",
    alert_email: true,
    alert_in_app: true,
  });

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setForm({
      display_name: p.display_name ?? "",
      headline: p.headline ?? "",
      county: p.county ?? "",
      phone: p.phone ?? "",
      news_topics: (p.news_topics ?? []).join(", "),
      alert_email: p.alert_email,
      alert_in_app: p.alert_in_app,
    });
  }, [profile.data]);

  const toggle = useMutation({
    mutationFn: async ({ role, on }: { role: AppRole; on: boolean }) =>
      on ? addRole(role) : removeRole(role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-roles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      upsertMyProfile({
        display_name: form.display_name || null,
        headline: form.headline || null,
        county: form.county || null,
        phone: form.phone || null,
        news_topics: form.news_topics
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        alert_email: form.alert_email,
        alert_in_app: form.alert_in_app,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mine = new Set(roles.data ?? []);

  return (
    <main className="min-h-dvh px-4 sm:px-6 pt-24 pb-16 max-w-4xl mx-auto">
      <Link
        to="/dashboard"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to dashboard
      </Link>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Halisia AI</div>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-display font-semibold">
          <UserCog className="h-6 w-6 text-accent" aria-hidden="true" /> Account &amp; roles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick every role that applies to you. Your dashboard adapts to what you select.
        </p>
      </header>

      <section className="mb-8" aria-label="Account types">
        {GROUPS.map((g) => (
          <div key={g} className="mb-5">
            <h2 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {g}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ROLE_CATALOG.filter((r) => r.group === g).map((r) => {
                const on = mine.has(r.value);
                const locked = r.value === "administrator";
                return (
                  <li key={r.value}>
                    <button
                      type="button"
                      disabled={locked || toggle.isPending}
                      onClick={() => toggle.mutate({ role: r.value, on: !on })}
                      aria-pressed={on}
                      data-testid="role-toggle"
                      className={`glass flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left transition disabled:opacity-50 ${
                        on ? "border-accent/50 bg-accent/10" : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
                          on ? "border-accent bg-accent text-primary-foreground" : "border-white/25"
                        }`}
                        aria-hidden="true"
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{r.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{r.blurb}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground/80">
          <ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Administrator access is granted by Halisia and cannot be self-assigned.
        </p>
      </section>

      <section aria-label="Profile details">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          Profile, news &amp; alerts
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="glass grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2"
        >
          <Text
            label="Display name"
            value={form.display_name}
            onChange={(v) => setForm({ ...form, display_name: v })}
          />
          <Text
            label="Headline"
            value={form.headline}
            onChange={(v) => setForm({ ...form, headline: v })}
          />
          <Text
            label="County"
            value={form.county}
            onChange={(v) => setForm({ ...form, county: v })}
          />
          <Text label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div className="sm:col-span-2">
            <Text
              label="News topics (comma separated)"
              value={form.news_topics}
              onChange={(v) => setForm({ ...form, news_topics: v })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.alert_email}
              onChange={(e) => setForm({ ...form, alert_email: e.target.checked })}
              className="h-4 w-4 accent-[oklch(0.68_0.19_249)]"
            />
            Email alerts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.alert_in_app}
              onChange={(e) => setForm({ ...form, alert_in_app: e.target.checked })}
              className="h-4 w-4 accent-[oklch(0.68_0.19_249)]"
            />
            In-app alerts
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              Save profile
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      />
    </label>
  );
}
