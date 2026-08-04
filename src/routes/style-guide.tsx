import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Surface,
  KitButton,
  SegmentedTabs,
  SectionHeading,
  KenyaMotif,
  StatusBadge,
  ConfidenceIndicator,
} from "@/components/halisia/ds";
import { useReducedMotionPref } from "@/hooks/use-reduced-motion-pref";

const TITLE = "Design System & Brand Style Guide — HALISIA.AI";
const DESCRIPTION =
  "The HALISIA.AI design system: Kenyan flag colour tokens, typography scale, glass elevation levels, buttons, tabs, motion rules and accessibility standards for the product team.";

export const Route = createFileRoute("/style-guide")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StyleGuidePage,
});

const COLORS: Array<{ name: string; hex: string; use: string; swatch: string }> = [
  { name: "Deep Black", hex: "#050706", use: "App background", swatch: "bg-[#050706]" },
  { name: "Panel Black", hex: "#0B0F0D", use: "Glass panels, popovers", swatch: "bg-[#0B0F0D]" },
  { name: "Surface", hex: "#111614", use: "Elevation 1 tiles", swatch: "bg-[#111614]" },
  {
    name: "Emerald Green",
    hex: "#008F55",
    use: "Verified, positive, primary",
    swatch: "bg-[#008F55]",
  },
  { name: "Crimson Red", hex: "#BB1E2D", use: "Risk, alerts, destructive", swatch: "bg-[#BB1E2D]" },
  {
    name: "Metallic Gold",
    hex: "#D4AF37",
    use: "Premium & AI moments only",
    swatch: "bg-[#D4AF37]",
  },
  { name: "Silver", hex: "#AEB7BC", use: "Secondary text, borders", swatch: "bg-[#AEB7BC]" },
  { name: "Soft White", hex: "#F5F7F8", use: "Primary text", swatch: "bg-[#F5F7F8]" },
];

const TYPE_ROWS = [
  {
    role: "Display / H1",
    family: "Space Grotesk",
    note: "Hero titles. clamp(2.1rem → 4rem), -0.02em.",
  },
  {
    role: "Heading / H2–H4",
    family: "Space Grotesk",
    note: "Section and panel titles, 600–700 weight.",
  },
  { role: "Body", family: "Inter", note: "Paragraphs and UI copy, 1.7 line-height." },
  { role: "Label / micro", family: "Inter", note: "Uppercase eyebrows, 0.18em tracking." },
  {
    role: "Premium report",
    family: "Cormorant Garamond",
    note: "PDF dossiers and editorial pull-quotes only.",
  },
];

const MOTION_ROWS = [
  {
    name: "Micro",
    token: "--motion-micro",
    value: "180ms",
    use: "Hover, press, tab switch, badge changes",
  },
  { name: "Panel", token: "--motion-panel", value: "320ms", use: "Sheets, modals, panel rise-in" },
  {
    name: "Easing",
    token: "--motion-ease",
    value: "cubic-bezier(0.22, 1, 0.36, 1)",
    use: "All transitions",
  },
];

function StyleGuidePage() {
  const [tab, setTab] = useState("foundations");
  const [reduced, , setReduced] = useReducedMotionPref();

  return (
    <div className="min-h-dvh" data-testid="style-guide">
      <main className="mx-auto w-full max-w-6xl px-4 pt-24 pb-20 sm:px-6">
        <header className="relative overflow-hidden rounded-3xl">
          <Surface elevation={3} padding="lg" className="relative overflow-hidden">
            <KenyaMotif variant="shield" />
            <SectionHeading
              as="h1"
              eyebrow="Halisia Design System"
              title="Brand & interface style guide"
              description="One source of truth for colour, type, elevation, controls and motion. Build every new screen from these primitives so the product stays coherent."
            />
            <div className="kenya-rule mt-5" />
          </Surface>
        </header>

        <div className="mt-6">
          <SegmentedTabs
            label="Style guide sections"
            value={tab}
            onValueChange={setTab}
            items={[
              { value: "foundations", label: "Foundations" },
              { value: "surfaces", label: "Surfaces" },
              { value: "controls", label: "Controls" },
              { value: "motion", label: "Motion & a11y" },
            ]}
          />
        </div>

        {tab === "foundations" ? (
          <section className="mt-6 space-y-6" aria-label="Foundations">
            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                eyebrow="Section 19"
                title="Colour system"
                description="Kenyan flag palette. Green means verified or positive, red means risk, gold is reserved for premium and AI moments."
              />
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {COLORS.map((c) => (
                  <li key={c.hex}>
                    <Surface elevation={1} padding="sm" className="h-full">
                      <div
                        className={`h-14 w-full rounded-xl border border-white/10 ${c.swatch}`}
                        aria-hidden="true"
                      />
                      <p className="mt-2 text-sm font-semibold">{c.name}</p>
                      <p className="font-data text-muted-foreground">{c.hex}</p>
                      <p className="text-muted-foreground mt-1 text-xs">{c.use}</p>
                    </Surface>
                  </li>
                ))}
              </ul>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                eyebrow="Section 20"
                title="Typography"
                description="Three families, no more. Space Grotesk for structure, Inter for reading, Cormorant Garamond for premium reports."
              />
              <div className="mt-4 space-y-3">
                {TYPE_ROWS.map((t) => (
                  <Surface
                    key={t.role}
                    elevation={1}
                    padding="sm"
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="text-sm font-semibold">{t.role}</span>
                    <span className="font-data text-accent">{t.family}</span>
                    <span className="text-muted-foreground w-full text-xs sm:w-auto">{t.note}</span>
                  </Surface>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                <p className="font-hero text-3xl">Land intelligence, made legible</p>
                <p className="text-muted-foreground max-w-prose text-sm">
                  Body copy uses Inter at 1.7 line-height for long-form analysis blocks.
                </p>
                <p className="font-editorial text-xl">
                  Premium report headings use Cormorant Garamond.
                </p>
              </div>
            </Surface>
          </section>
        ) : null}

        {tab === "surfaces" ? (
          <section className="mt-6 space-y-6" aria-label="Surfaces">
            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                eyebrow="Section 21"
                title="Glass elevation levels"
                description="Elevation 1 for quiet tiles, 2 for standard panels, 3 for premium and AI surfaces. Radius scales 16 → 20 → 24px."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {([1, 2, 3] as const).map((lvl) => (
                  <Surface key={lvl} elevation={lvl} padding="md" data-testid={`elev-demo-${lvl}`}>
                    <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
                      Elevation {lvl}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {lvl === 1 ? "Quiet tile" : lvl === 2 ? "Standard panel" : "Premium / AI"}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {lvl === 1
                        ? "Lists, metrics, nested content."
                        : lvl === 2
                          ? "Default container for a section."
                          : "Gold edge. One per screen, maximum."}
                    </p>
                  </Surface>
                ))}
              </div>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                title="Luminous edges"
                description="Restrained 1px edge plus a soft halo. Use to signal state, never for decoration."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["green", "red", "gold", "silver"] as const).map((edge) => (
                  <Surface key={edge} elevation={1} edge={edge} padding="sm">
                    <p className="text-sm font-semibold capitalize">{edge} edge</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {edge === "green"
                        ? "Verified / positive"
                        : edge === "red"
                          ? "Risk / alert"
                          : edge === "gold"
                            ? "Premium / AI"
                            : "Neutral emphasis"}
                    </p>
                  </Surface>
                ))}
              </div>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                title="Kenya motif"
                description="Controlled geometry only: a surveyor grid with contour washes, or Maasai-shield chevrons. Always decorative, never animated, never neon."
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Surface elevation={1} padding="md" className="relative overflow-hidden">
                  <KenyaMotif variant="grid" />
                  <p className="text-sm font-semibold">Survey grid</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Default texture for dashboards and data panels.
                  </p>
                </Surface>
                <Surface elevation={1} padding="md" className="relative overflow-hidden">
                  <KenyaMotif variant="shield" />
                  <p className="text-sm font-semibold">Shield chevrons</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Reserved for hero and premium surfaces.
                  </p>
                </Surface>
              </div>
            </Surface>
          </section>
        ) : null}

        {tab === "controls" ? (
          <section className="mt-6 space-y-6" aria-label="Controls">
            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                title="Buttons"
                description="Primary for the single main action, secondary for everything else, premium for AI/report actions, destructive for irreversible ones."
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <KitButton variant="primary">Run analysis</KitButton>
                <KitButton variant="secondary">Cancel</KitButton>
                <KitButton variant="premium">Generate AI dossier</KitButton>
                <KitButton variant="destructive">Delete listing</KitButton>
                <KitButton variant="secondary" disabled>
                  Disabled
                </KitButton>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <KitButton size="sm" variant="secondary">
                  Small
                </KitButton>
                <KitButton size="md" variant="secondary">
                  Medium
                </KitButton>
                <KitButton size="lg" variant="secondary">
                  Large
                </KitButton>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                All buttons meet the 44×44px touch target on mobile and show a gold focus ring on
                keyboard focus.
              </p>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                title="Segmented tabs"
                description="Roving tabindex: Arrow keys move between tabs, Home and End jump to the ends."
              />
              <div className="mt-4">
                <SegmentedTabs
                  label="Demo tabs"
                  value={tab === "controls" ? "overview" : "overview"}
                  onValueChange={() => {}}
                  items={[
                    { value: "overview", label: "Overview" },
                    { value: "data", label: "Data" },
                    { value: "risk", label: "Risk", alert: true },
                  ]}
                />
              </div>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading as="h3" title="Status & confidence" />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusBadge kind="verified" />
                <StatusBadge kind="ai" />
                <StatusBadge kind="government" />
                <StatusBadge kind="premium" />
                <StatusBadge kind="pending" />
              </div>
              <div className="mt-4 max-w-sm">
                <ConfidenceIndicator pct={82} sources={14} />
              </div>
            </Surface>
          </section>
        ) : null}

        {tab === "motion" ? (
          <section className="mt-6 space-y-6" aria-label="Motion and accessibility">
            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                eyebrow="Section 22"
                title="Motion rules"
                description="Fast and purposeful. Nothing bounces, nothing loops in the background."
              />
              <div className="mt-4 space-y-3">
                {MOTION_ROWS.map((m) => (
                  <Surface
                    key={m.token}
                    elevation={1}
                    padding="sm"
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="font-data text-accent">{m.value}</span>
                    <span className="text-muted-foreground w-full text-xs sm:w-auto">{m.use}</span>
                  </Surface>
                ))}
              </div>
            </Surface>

            <Surface elevation={2} padding="lg">
              <SectionHeading
                as="h3"
                title="Accessibility standards"
                description="Every screen must clear these before it ships."
              />
              <ul className="text-muted-foreground mt-4 list-disc space-y-2 pl-5 text-sm">
                <li>Body and label text uses tokenised foreground colours — never raw greys.</li>
                <li>Visible gold focus ring on every focusable element, 2px with 2px offset.</li>
                <li>Icon-only controls carry an aria-label; touch targets are at least 44×44px.</li>
                <li>One h1 per page and no skipped heading levels.</li>
                <li>
                  All animation is disabled when the operating system or the in-app toggle requests
                  reduced motion.
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <KitButton
                  variant={reduced ? "primary" : "secondary"}
                  aria-pressed={reduced}
                  onClick={() => setReduced(!reduced)}
                  data-testid="style-guide-reduce-motion"
                >
                  Reduce motion: {reduced ? "On" : "Off"}
                </KitButton>
                <span className="text-muted-foreground text-xs">
                  Saved to this browser and applied across the whole app.
                </span>
              </div>
            </Surface>
          </section>
        ) : null}
      </main>
    </div>
  );
}
