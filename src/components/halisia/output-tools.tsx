import { visibleOutputText } from "./output-text";
import { useRef, useState } from "react";
import {
  Building2,
  Database,
  Droplets,
  Gem,
  GraduationCap,
  HeartPulse,
  Layers,
  Leaf,
  Mountain,
  Route,
  Sprout,
  Zap,
} from "lucide-react";
import { ListenButton } from "./listen-button";
import {
  referencesForOutput,
  referencePage,
  referenceLicense,
  type OutputReference,
} from "@/lib/output-visuals";

export function OutputIcon({ subject }: { subject: string }) {
  const rules = [
    [/school|education/i, GraduationCap],
    [/hospital|health/i, HeartPulse],
    [/soil|geology/i, Layers],
    [/foundation|building|construction/i, Building2],
    [/mineral|quartz|gold|mining/i, Gem],
    [/crop|maize|tea|farm|agricultur/i, Sprout],
    [/water|borehole|drainage/i, Droplets],
    [/road|transport|transit|infrastructure/i, Route],
    [/electric|power|energy/i, Zap],
    [/terrain|slope|elevation/i, Mountain],
    [/forest|natural|environment/i, Leaf],
  ] as const;
  const Icon = rules.find(([pattern]) => pattern.test(subject))?.[1] ?? Database;
  return (
    <span className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10">
      <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
    </span>
  );
}

/** Read only rendered output, excluding controls, hidden details and other readers. */

function ReferenceImage({ item }: { item: OutputReference }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-foreground/10 bg-background/50">
      {!failed ? (
        <a href={referencePage(item)} target="_blank" rel="noreferrer">
          <img
            src={item.src}
            alt={`${item.title}. Reference example from ${item.location}; not this parcel.`}
            loading="lazy"
            decoding="async"
            className="h-32 w-full object-contain"
            onError={() => setFailed(true)}
          />
        </a>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
          <OutputIcon subject={item.title} /> Image unavailable
        </div>
      )}
      <figcaption className="space-y-1 p-2 text-[10px] leading-relaxed text-muted-foreground">
        <span className="block font-semibold text-accent">
          Reference illustration · not site evidence
        </span>
        <span className="block">
          {item.title} · {item.location}
        </span>
        <a href={referencePage(item)} target="_blank" rel="noreferrer" className="underline">
          {item.author} · Wikimedia Commons
        </a>
        {" · "}
        <a href={referenceLicense(item)} target="_blank" rel="noreferrer" className="underline">
          {item.license}
        </a>
      </figcaption>
    </figure>
  );
}

export function OutputVisual({ subject, value }: { subject: string; value?: string | null }) {
  if (value === null || value === "—" || value === "Not available") return null;
  const items = referencesForOutput(`${subject} ${value ?? ""}`);
  if (!items.length) return null;
  return (
    <div data-output-tools className="mt-3 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <ReferenceImage key={item.file} item={item} />
      ))}
    </div>
  );
}

/** Mount directly inside a data-output-card; reads fresh values on each click. */
export function OutputTools({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} data-output-tools className="mt-2 flex flex-wrap items-center gap-2">
      <ListenButton
        label={`Listen to ${label}`}
        text={() => {
          const card = ref.current?.closest("[data-output-card]");
          return `${label}. ${card ? visibleOutputText(card) : "No output available."}`;
        }}
      />
    </div>
  );
}
