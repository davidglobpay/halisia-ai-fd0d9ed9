import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Palette, Ruler, Type } from "lucide-react";

export const Route = createFileRoute("/token-audit")({
  component: TokenAuditPage,
  head: () => ({
    meta: [
      { title: "Design token audit — HALISIA.AI" },
      {
        name: "description",
        content:
          "Live audit of HALISIA design tokens: active colors, typography and glass elevations, with legacy Kenyan-flag palette values flagged.",
      },
      { property: "og:title", content: "HALISIA design token audit" },
      {
        property: "og:description",
        content: "Active colors, typography and elevations with legacy palette values flagged.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Colour tokens read from :root at runtime. */
const COLOR_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
  "--h-ivory",
  "--h-ivory-2",
  "--h-ivory-3",
  "--h-ivory-4",
  "--h-forest",
  "--h-forest-2",
  "--h-forest-3",
  "--h-green",
  "--h-green-2",
  "--h-green-3",
  "--h-gold",
  "--h-gold-2",
  "--h-gold-3",
  "--h-red",
  "--h-stone",
  "--h-stone-2",
  "--electric",
  "--cyan-glow",
  "--emerald-glow",
  "--amber-glow",
  "--flamingo",
  "--earth",
  "--cream",
  "--silver",
];

const FONT_TOKENS = [
  { token: "--font-hero", use: "Hero headline", expect: "Space Grotesk" },
  { token: "--font-display", use: "Section headings", expect: "Space Grotesk" },
  { token: "--font-card", use: "Card titles", expect: "Space Grotesk" },
  { token: "--font-sans", use: "Body copy", expect: "Inter" },
  { token: "--font-label", use: "Labels / eyebrows", expect: "Inter" },
  { token: "--font-editorial", use: "Premium report headings", expect: "Cormorant Garamond" },
  { token: "--font-numeric", use: "Metrics / tabular numbers", expect: "IBM Plex Mono" },
  { token: "--font-mono", use: "Code / identifiers", expect: "IBM Plex Mono" },
];

const ELEVATIONS = [
  { cls: "elev-1", use: "Rails, list tiles, inputs" },
  { cls: "elev-2", use: "Panels, dialogs, side sheets" },
  { cls: "elev-3", use: "Overlays, floating controls" },
  { cls: "holo-hero", use: "Holographic section hero tile" },
  { cls: "holo-tile", use: "Holographic detail tile" },
  { cls: "glass", use: "Legacy glass surface" },
];

/**
 * Legacy "Deep Space Blue / Kenyan flag" palette values. Any active token
 * resolving to one of these is a leftover from the pre-ivory skin.
 */
const LEGACY_HEX = [
  "#071e3d",
  "#0a2547",
  "#00c2e8",
  "#00e5ff",
  "#22d3ee",
  "#d4a017",
  "#bb0000",
  "#ce1126",
  "#006600",
  "#000000",
  "#0f172a",
  "#3b82f6",
];

function normalize(v: string) {
  return v.trim().toLowerCase();
}

function isLegacy(value: string) {
  const v = normalize(value);
  return LEGACY_HEX.some((hex) => v.includes(hex));
}

type Resolved = { token: string; value: string; legacy: boolean };

function TokenAuditPage() {
  const [colors, setColors] = useState<Resolved[]>([]);
  const [fonts, setFonts] = useState<{ token: string; value: string }[]>([]);

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setColors(
      COLOR_TOKENS.map((token) => {
        const value = cs.getPropertyValue(token);
        return { token, value: value.trim() || "(unset)", legacy: isLegacy(value) };
      }),
    );
    setFonts(
      FONT_TOKENS.map(({ token }) => ({
        token,
        value: cs.getPropertyValue(token).trim() || "(unset)",
      })),
    );
  }, []);

  const flagged = useMemo(() => colors.filter((c) => c.legacy), [colors]);
  const fontIssues = useMemo(
    () =>
      FONT_TOKENS.filter(({ token, expect }) => {
        const v = fonts.find((f) => f.token === token)?.value ?? "";
        return v !== "" && !normalize(v).includes(normalize(expect));
      }),
    [fonts],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-12" data-testid="token-audit">
      <header className="max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Design system</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Design token audit
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live values read from the running stylesheet. Any token still resolving to the retired
          Deep-Space-Blue / Kenyan-flag palette is flagged below.
        </p>
      </header>

      <section
        data-testid="token-audit-summary"
        data-legacy-count={flagged.length}
        data-font-issue-count={fontIssues.length}
        className="holo-hero mt-6 flex flex-wrap items-center gap-4 rounded-2xl p-5"
      >
        {flagged.length === 0 && fontIssues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            All {colors.length} colour tokens and {FONT_TOKENS.length} type roles match the approved
            ivory-glass skin.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {flagged.length} legacy colour token{flagged.length === 1 ? "" : "s"} and{" "}
            {fontIssues.length} typography mismatch{fontIssues.length === 1 ? "" : "es"} need
            attention.
          </p>
        )}
      </section>

      <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
        <Palette className="h-4 w-4 text-accent" aria-hidden="true" /> Active colours
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {colors.map((c) => (
          <li
            key={c.token}
            data-testid={c.legacy ? "token-legacy" : "token-ok"}
            className="holo-tile flex items-center gap-3 rounded-2xl p-3"
          >
            <span
              aria-hidden="true"
              className="h-9 w-9 shrink-0 rounded-lg border border-foreground/15"
              style={{ background: `var(${c.token})` }}
            />
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px] text-foreground">
                {c.token}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{c.value}</span>
            </span>
            {c.legacy && (
              <span className="ml-auto rounded-full border border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                Legacy
              </span>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
        <Type className="h-4 w-4 text-accent" aria-hidden="true" /> Typography roles
      </h2>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {FONT_TOKENS.map((f) => {
          const value = fonts.find((x) => x.token === f.token)?.value ?? "";
          const ok = value === "" || normalize(value).includes(normalize(f.expect));
          return (
            <li
              key={f.token}
              data-testid={ok ? "font-ok" : "font-mismatch"}
              className="holo-tile rounded-2xl p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px]">{f.token}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    ok
                      ? "border border-primary/40 bg-primary/10 text-primary"
                      : "border border-destructive/50 bg-destructive/10 text-destructive"
                  }`}
                >
                  {ok ? f.expect : "Mismatch"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{f.use}</p>
              <p className="mt-2 text-xl" style={{ fontFamily: `var(${f.token})` }}>
                Halisia 0123 — Kenya land intelligence
              </p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 flex items-center gap-2 text-lg font-semibold">
        <Ruler className="h-4 w-4 text-accent" aria-hidden="true" /> Elevations
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ELEVATIONS.map((e) => (
          <li key={e.cls} className={`${e.cls} rounded-2xl p-4`} data-testid="elevation-sample">
            <span className="font-mono text-[11px] text-foreground">{e.cls}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{e.use}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
