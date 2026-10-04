import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Map,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { SectionHeading, StatusBadge, Surface } from "@/components/halisia/ds";

export const Route = createFileRoute("/system-status")({
  head: () => ({
    meta: [
      { title: "System Status — HALISIA AI" },
      { name: "description", content: "HALISIA feature verification and release-readiness links." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SystemStatusPage,
});

const checks = [
  {
    icon: Bot,
    title: "AI gateway",
    status: "Astra-ready",
    detail:
      "Provider-neutral model selection, bounded inputs, timeout protection and sanitized errors.",
    to: "/",
    test: "Open the assistant and submit a land-intelligence question.",
  },
  {
    icon: ShieldCheck,
    title: "Design system",
    status: "Aligned",
    detail:
      "Production light-glass colors, typography, surfaces, controls and accessibility rules.",
    to: "/style-guide",
    test: "Inspect Foundations, Surfaces, Controls and Motion tabs.",
  },
  {
    icon: Map,
    title: "Spatial experience",
    status: "Protected",
    detail:
      "Existing WebXR, Scene Viewer, Quick Look fallbacks and parcel fixtures remain untouched.",
    to: "/spatial",
    test: "Run device-specific AR/3D checks on supported hardware.",
  },
  {
    icon: Smartphone,
    title: "Responsive navigation",
    status: "Available",
    detail: "Keyboard-aware desktop navigation and an inert, focus-safe mobile menu.",
    to: "/explore",
    test: "Test at 360px, 768px and desktop widths, including keyboard navigation.",
  },
  {
    icon: Database,
    title: "Resource Intelligence",
    status: "M0-A",
    detail:
      "Evidence-first foundation for LAND, LIMAR, MADINI and ENERGY with server-side verification guards.",
    to: "/resource-intelligence",
    test: "Confirm database connection, feature flags, evidence counts and truth rules.",
  },
];

function SystemStatusPage() {
  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-20 pt-24 sm:px-6"
      data-testid="system-status"
    >
      <Surface elevation={3} padding="lg">
        <SectionHeading
          as="h1"
          eyebrow="Release verification"
          title="HALISIA system status"
          description="Direct test surfaces for the current enhancement batch. Status labels describe implementation state—not external-data verification."
        />
        <div className="kenya-rule mt-5" />
      </Surface>

      <section className="mt-6 grid gap-4 md:grid-cols-2" aria-label="Feature checks">
        {checks.map(({ icon: Icon, title, status, detail, to, test }) => (
          <Surface key={title} elevation={2} padding="md" className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <StatusBadge kind="verified">{status}</StatusBadge>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              <strong className="text-foreground">Test:</strong> {test}
            </p>
            <Link
              to={to}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open test surface <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Surface>
        ))}
      </section>

      <Surface elevation={2} padding="md" className="mt-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Release rule</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish to staging first. Promote to production only after typecheck, unit tests,
              build, accessibility checks and physical AR/device tests pass.
            </p>
          </div>
        </div>
      </Surface>
    </main>
  );
}
