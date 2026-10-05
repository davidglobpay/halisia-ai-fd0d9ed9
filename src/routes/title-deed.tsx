import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileUp,
  Loader2,
  ScanSearch,
  ShieldAlert,
  FileDown,
  Sparkles,
  Camera,
  X,
  Check,
  MapPin,
  Mic,
  MicOff,
  History,
  Share2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { MapView } from "@/components/halisia/map-view";
import { ParcelPin, type PinnedPoint } from "@/components/halisia/parcel-pin";
import { MutationUpload } from "@/components/halisia/mutation-upload";
import { ParcelDraw } from "@/components/halisia/parcel-draw";
import { BuildBrief } from "@/components/halisia/build-brief";
import type { LatLng } from "@/lib/parcel-geometry";
import { generateParcelReport } from "@/lib/pdf-parcel-report";
import type { MutationPlan, DeedPlanAgreement } from "@/lib/mutation-plan";
import { IntelligenceDashboard } from "@/components/halisia/intelligence-dashboard";
import { extractDeedFields, type DeedFields } from "@/lib/deed-extract.functions";
import { geocodeAddress } from "@/lib/geocode.functions";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { useDeedHistory, type DeedHistoryEntry } from "@/hooks/use-deed-history";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Link } from "@tanstack/react-router";
import {
  classifyGeocode,
  compareCounty,
  assessDeedLocationMatch,
  deedLocationQuery,
  validateCoordinate,
  type Discrepancy,
  type LocationStatus,
} from "@/lib/location-validation";
import { LocationStatusCard } from "@/components/halisia/land-passport/location-status";
import { PassportLinks } from "@/components/halisia/land-passport/passport-links";
import { ListenButton } from "@/components/halisia/listen-button";

type DeedLoc = {
  lat: number;
  lng: number;
  address: string;
  status: LocationStatus;
  gt: string;
  county: string | null;
  discrepancy: Discrepancy | null;
  issues: string[];
  /** Half-diagonal of Google's own viewport for the match, in metres. */
  radiusM: number | null;
  /** Google had to guess at part of the query. */
  partialMatch: boolean;
};

/** Validate a geocode hit for a deed. Never upgrades it past "approximate". */
function buildDeedLoc(
  res: {
    lat: number;
    lng: number;
    address: string;
    locationType?: string;
    types?: string[];
    radiusM?: number | null;
    partialMatch?: boolean;
  },
  deedCounty: string | null | undefined,
): { loc: DeedLoc } | { issue: string } {
  const check = validateCoordinate(res.lat, res.lng);
  if (!check.ok || check.lat == null || check.lng == null)
    return { issue: `Pin withheld: ${check.issues[0]}` };
  const types = res.types ?? [];
  if (types.includes("country"))
    return { issue: "Only “Kenya” matched the location text — too vague to place a pin." };
  return {
    loc: {
      lat: check.lat,
      lng: check.lng,
      address: res.address,
      status: classifyGeocode(types),
      gt: res.locationType ?? "APPROXIMATE",
      county: deedCounty ?? null,
      discrepancy: compareCounty({ lat: check.lat, lng: check.lng }, deedCounty, "Geocoded pin"),
      issues: check.issues,
      radiusM: res.radiusM ?? null,
      partialMatch: Boolean(res.partialMatch),
    },
  };
}

export const Route = createFileRoute("/title-deed")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Title Deed Search — HALISIA AI" },
      {
        name: "description",
        content:
          "Search Kenyan land by Title Number, LR, Parcel, or upload a deed image/PDF for AI extraction, geolocation, and intelligence.",
      },
      { property: "og:title", content: "Title Deed Search — HALISIA AI" },
      {
        property: "og:description",
        content: "AI-powered title deed extraction, geolocation, and land intelligence for Kenya.",
      },
    ],
  }),
  component: TitleDeedPage,
});

type Stage = "idle" | "ocr" | "extract" | "locate" | "done" | "error";

function TitleDeedPage() {
  const [mode, setMode] = useState<"query" | "upload">("query");
  const [queryType, setQueryType] = useState<"title" | "lr" | "parcel" | "registry">("title");
  const [queryValue, setQueryValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [fields, setFields] = useState<DeedFields | null>(null);
  const [officialSearch, setOfficialSearch] = useState(false);
  const [loc, setLoc] = useState<DeedLoc | null>(null);
  const [locIssue, setLocIssue] = useState<string | null>(null);
  /**
   * The point the user placed by hand, if they have placed one.
   *
   * Kept separate from `loc` rather than overwriting it: the geocoded match is
   * evidence of what the record's text resolves to, and the pin is evidence of
   * what a person recognised on the ground. Both belong in the record, and
   * collapsing them would lose the distance between them, which is the single
   * most useful number on this screen.
   */
  const [pinned, setPinned] = useState<PinnedPoint | null>(null);
  /** The boundary sketched in Step 3, lifted here so Step 4 can measure it. */
  const [boundary, setBoundary] = useState<LatLng[]>([]);
  /** Everything Steps 2 and 4 established, held here so the report can carry it. */
  const [planRead, setPlanRead] = useState<{
    plan: MutationPlan | null;
    agreement: DeedPlanAgreement | null;
  } | null>(null);
  const [briefState, setBriefState] = useState<{
    setbacks: { frontM: number; sideM: number };
    briefText: string;
  } | null>(null);
  const [reporting, setReporting] = useState(false);

  // A new search means a new parcel. Carrying a pin across would silently
  // attach the last plot's position to this one.
  useEffect(() => {
    setPinned(null);
    setBoundary([]);
    setPlanRead(null);
  }, [loc?.lat, loc?.lng]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const history = useDeedHistory();

  const processQueryValue = useCallback(
    async (value: string) => {
      const q = value.trim();
      if (!q) return;
      setError(null);
      setStage("extract");
      setProgressMsg("Interpreting reference…");
      try {
        const label =
          queryType === "title"
            ? "Title Number"
            : queryType === "lr"
              ? "L.R. Number"
              : queryType === "parcel"
                ? "Parcel Number"
                : "Registry";
        const synthetic = `${label}: ${q}`;
        const extracted = await extractDeedFields({ data: { text: synthetic } });
        setFields(extracted);
        setOcrText(synthetic);

        // Geolocate and capture result for history in one flow
        setStage("locate");
        setProgressMsg("Geolocating parcel…");
        setProgress(0);
        const geoQuery = deedLocationQuery(extracted);
        let located: DeedLoc | null = null;
        setLoc(null);
        setLocIssue(null);
        if (geoQuery) {
          try {
            const res = await geocodeAddress({ data: { query: geoQuery } });
            const built = res.ok ? buildDeedLoc(res, extracted.county) : null;
            if (built && "loc" in built) {
              located = built.loc;
              setLoc(located);
            } else
              setLocIssue(built?.issue ?? "No place matched the location text on this record.");
          } catch (err) {
            console.warn("locate failed", err);
            setLocIssue("Location service unavailable — try again shortly.");
          }
        } else setLocIssue("The record has no location text, so no pin is shown.");
        setStage("done");
        history.add({
          mode: "query",
          label: `${label}: ${q}`,
          queryType,
          queryValue: q,
          fields: {
            titleNumber: extracted.titleNumber,
            lrNumber: extracted.lrNumber,
            parcelNumber: extracted.parcelNumber,
            county: extracted.county,
            registry: extracted.registry,
            confidence: extracted.confidence,
          },
          location: located ?? undefined,
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Search failed");
        setStage("error");
      }
    },
    [queryType, history],
  );

  const voice = useVoiceInput({
    onFinal: (transcript) => {
      const cleaned = transcript.replace(/[.,!?]$/g, "").trim();
      setQueryValue(cleaned);
      setMode("query");
      setTimeout(() => processQueryValue(cleaned), 50);
    },
  });

  const shareUrl = useMemo(() => {
    if (!loc || typeof window === "undefined") return "";
    const params = new URLSearchParams({
      lat: String(loc.lat),
      lng: String(loc.lng),
      address: loc.address,
    });
    const ref = fields?.titleNumber || fields?.lrNumber || fields?.parcelNumber || queryValue || "";
    if (ref) params.set("ref", ref);
    return `${window.location.origin}/report?${params.toString()}`;
  }, [loc, fields, queryValue]);

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setProgressMsg("");
    setOcrText("");
    setFields(null);
    setLoc(null);
    setError(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);
  };

  const runOcr = useCallback(async (image: File | Blob): Promise<string> => {
    setStage("ocr");
    setProgressMsg("Running OCR on your document…");
    const { default: Tesseract } = await import("tesseract.js");
    const result = await Tesseract.recognize(image, "eng", {
      logger: (m: { status: string; progress?: number }) => {
        if (typeof m.progress === "number") setProgress(Math.round(m.progress * 100));
        if (m.status) setProgressMsg(m.status);
      },
    });
    return (result.data.text || "").trim();
  }, []);

  const locateFrom = useCallback(async (f: DeedFields): Promise<void> => {
    setStage("locate");
    setProgressMsg("Geolocating parcel…");
    setProgress(0);
    const query = deedLocationQuery(f);
    setLoc(null);
    setLocIssue(null);
    if (!query) {
      setLocIssue("The document has no readable location text, so no pin is shown.");
      return;
    }
    try {
      const res = await geocodeAddress({ data: { query } });
      const built = res.ok ? buildDeedLoc(res, f.county) : null;
      if (built && "loc" in built) setLoc(built.loc);
      else setLocIssue(built?.issue ?? "No place matched the location text on this document.");
    } catch (e) {
      console.warn("locate failed", e);
      setLocIssue("Location service unavailable — try again shortly.");
    }
  }, []);

  const locationMatch = useMemo(() => {
    if (!loc) return null;
    const locationText = deedLocationQuery(fields ?? {});
    return assessDeedLocationMatch({
      status: loc.status,
      geocodeType: loc.gt,
      locationText: locationText || "No readable place text",
      locationTextConfidence:
        fields?.fieldConfidence?.locationHint ?? fields?.fieldConfidence?.county,
      countyNamed: fields?.county,
      countyConflict: Boolean(loc.discrepancy),
      partialMatch: loc.partialMatch,
      radiusM: loc.radiusM,
    });
  }, [fields, loc]);

  const processUpload = async () => {
    if (!file) return;
    setError(null);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        // For PDF, ask the user's browser to render first page via a canvas fallback:
        // Tesseract can't read PDFs directly; extract using pdfjs would add heavy deps.
        // Provide a friendly message + accept text from user if needed.
        throw new Error(
          "PDF OCR requires image conversion. Please upload a photo/screenshot of the deed page for now.",
        );
      } else {
        text = await runOcr(file);
      }
      setOcrText(text);
      if (!text || text.length < 20)
        throw new Error("OCR returned too little text. Try a clearer image.");

      setStage("extract");
      setProgressMsg("AI extracting structured fields…");
      setProgress(50);
      const extracted = await extractDeedFields({ data: { text } });
      setFields(extracted);

      await locateFrom(extracted);
      setStage("done");
      history.add({
        mode: "upload",
        label: file.name,
        fileName: file.name,
        fields: {
          titleNumber: extracted.titleNumber,
          lrNumber: extracted.lrNumber,
          parcelNumber: extracted.parcelNumber,
          county: extracted.county,
          registry: extracted.registry,
          confidence: extracted.confidence,
        },
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Processing failed");
      setStage("error");
    }
  };

  const processQuery = () => processQueryValue(queryValue);

  const replayEntry = (entry: DeedHistoryEntry) => {
    if (entry.mode === "query" && entry.queryValue) {
      setMode("query");
      if (entry.queryType) setQueryType(entry.queryType);
      setQueryValue(entry.queryValue);
      processQueryValue(entry.queryValue);
    }
  };

  const downloadReport = async () => {
    if (!loc) return;
    setDownloading(true);
    try {
      await generateLocationDossier({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        shareUrl,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const busy = stage === "ocr" || stage === "extract" || stage === "locate";

  return (
    <div className="min-h-screen">
      <div className="mx-auto min-w-0 max-w-[1400px] px-4 pb-16 pt-24">
        <header className="min-w-0 max-w-3xl">
          <div className="inline-flex items-center gap-2 glass rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-accent">
            <Sparkles className="h-3 w-3" /> Title Deed Intelligence
          </div>
          <h1 className="mt-4 font-display text-3xl md:text-4xl font-semibold tracking-tight">
            Search land by deed reference or upload the document
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            OCR, AI field extraction, and geolocation are informational only. Official ownership and
            title status can only be confirmed via authorized government registries.
          </p>
        </header>

        {/* Mode tabs */}
        <div className="mt-6 inline-flex glass rounded-full p-1">
          {(["query", "upload"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                mode === m
                  ? "bg-white/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "query" ? <ScanSearch className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
              {m === "query" ? "Search by reference" : "Upload document"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* LEFT: Input surface */}
          <div className="glass-strong min-w-0 overflow-hidden rounded-3xl p-4 sm:p-5">
            {mode === "query" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "title", label: "Title No." },
                      { id: "lr", label: "L.R." },
                      { id: "parcel", label: "Parcel" },
                      { id: "registry", label: "Registry" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setQueryType(t.id)}
                      className={`rounded-full px-3 py-1.5 text-xs border transition ${
                        queryType === t.id
                          ? "bg-accent/20 border-accent/60 text-foreground"
                          : "border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
                  <input
                    value={queryValue}
                    onChange={(e) => setQueryValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && processQuery()}
                    placeholder={
                      queryType === "lr"
                        ? "e.g. L.R. 209/12345 or NAIROBI/BLOCK 82/234"
                        : queryType === "parcel"
                          ? "e.g. Kajiado/Kitengela/2345"
                          : queryType === "registry"
                            ? "e.g. Nairobi Registry"
                            : "e.g. Title No. IR 123456"
                    }
                    className="min-w-0 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-accent/60 sm:flex-1"
                  />
                  {voice.supported && (
                    <button
                      type="button"
                      onClick={voice.listening ? voice.stop : voice.start}
                      aria-pressed={voice.listening}
                      title={voice.listening ? "Stop listening" : "Speak the title deed number"}
                      className={`rounded-2xl px-3 py-3 text-sm inline-flex items-center justify-center transition ${
                        voice.listening
                          ? "bg-accent/20 border border-accent/60 text-foreground animate-pulse"
                          : "glass border border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {voice.listening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={processQuery}
                    disabled={!queryValue.trim() || busy}
                    className="col-span-2 min-h-12 justify-center rounded-2xl px-4 py-3 text-sm bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-60 sm:col-span-1"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanSearch className="h-4 w-4" />
                    )}
                    Analyze
                  </button>
                </div>
                {(voice.interim || voice.error) && (
                  <div className="text-[11px]">
                    {voice.interim && (
                      <span className="text-accent">Listening: &ldquo;{voice.interim}&rdquo;…</span>
                    )}
                    {voice.error && <span className="text-amber-glow">{voice.error}</span>}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Without an authorized registry integration, we can normalize the reference and
                  attempt a locality lookup. Exact parcel boundaries require official data.
                </p>
              </div>
            ) : (
              <div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) onFile(f);
                  }}
                  className="rounded-2xl border-2 border-dashed border-white/15 bg-black/20 p-6 text-center"
                >
                  {previewUrl ? (
                    <div className="relative mx-auto max-w-md">
                      <img
                        src={previewUrl}
                        alt="Deed preview"
                        className="rounded-xl border border-white/10 max-h-72 mx-auto"
                      />
                      <button
                        onClick={() => {
                          setFile(null);
                          if (previewUrl) URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                        }}
                        className="absolute -top-2 -right-2 glass rounded-full p-1.5"
                        aria-label="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <FileUp className="h-8 w-8 mx-auto text-accent" />
                      <p className="mt-2 text-sm">Drag & drop a deed image, or</p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => inputRef.current?.click()}
                          className="glass rounded-full px-4 py-2 text-xs inline-flex items-center gap-1.5"
                        >
                          <FileUp className="h-3.5 w-3.5" /> Choose file
                        </button>
                        <label className="glass rounded-full px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer">
                          <Camera className="h-3.5 w-3.5" /> Camera
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        JPG, PNG supported. For PDFs, upload a screenshot of the deed page.
                      </p>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {file && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={processUpload}
                      disabled={busy}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScanSearch className="h-4 w-4" />
                      )}
                      Extract & analyze
                    </button>
                    <button onClick={reset} className="rounded-2xl px-4 py-3 text-sm glass">
                      Reset
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Progress */}
            {busy && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  {progressMsg || "Working…"}
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                    style={{ width: `${progress || 30}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-2xl border border-amber-glow/30 bg-amber-glow/5 p-3 text-xs text-amber-glow inline-flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{error}</div>
              </div>
            )}

            {/* Extracted fields */}
            {mode === "upload" && (
              <div
                className="mt-6 rounded-2xl border border-white/10 bg-card/70 p-4 text-xs"
                data-testid="official-search-guide"
              >
                <div className="font-semibold text-foreground">
                  Most accurate: upload your official Ardhisasa search
                </div>
                <ol className="mt-1 list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li>
                    Sign in to ardhisasa.lands.go.ke yourself (the SMS code goes only to you).
                  </li>
                  <li>Request an official search for the parcel and download the result.</li>
                  <li>Upload a photo or screenshot of it here.</li>
                </ol>
                <label className="mt-2 flex min-h-[44px] items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={officialSearch}
                    onChange={(e) => setOfficialSearch(e.target.checked)}
                  />
                  This upload is an official Ardhisasa search result
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  HALISIA never asks for your Ardhisasa login or SMS code. Details read from the
                  document are marked “Documents reviewed”, not government-verified, until a
                  licensed surveyor or advocate confirms them.
                </p>
              </div>
            )}
            {fields && officialSearch && mode === "upload" && (
              <div
                className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs"
                data-testid="official-search-badge"
              >
                Documents reviewed — read from an uploaded official search. Owner, size and parcel
                details below come from that document; confirm with a licensed surveyor before
                relying on them.
              </div>
            )}
            {fields && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Extracted fields
                  </h3>
                  <span className="text-[11px] text-accent inline-flex items-center gap-1">
                    <Check className="h-3 w-3" /> Confidence {fields.confidence}%
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  {(
                    [
                      ["Title No.", fields.titleNumber, "titleNumber"],
                      ["L.R. No.", fields.lrNumber, "lrNumber"],
                      ["Parcel No.", fields.parcelNumber, "parcelNumber"],
                      ["Registry", fields.registry, "registry"],
                      ["County", fields.county, "county"],
                      ["Registered area", fields.registeredArea, "registeredArea"],
                      ["Survey No.", fields.surveyNumber, "surveyNumber"],
                      ["Lease term", fields.leaseTerm, "leaseTerm"],
                      ["Registered date", fields.registrationDate, "registrationDate"],
                      ["Registered owner", fields.registeredOwner, "registeredOwner"],
                      ["Locality hint", fields.locationHint, "locationHint"],
                    ] as const
                  ).map(([label, val, key]) => {
                    const score = fields.fieldConfidence?.[key] ?? 0;
                    const tone =
                      score >= 75
                        ? "text-accent"
                        : score >= 45
                          ? "text-amber-glow"
                          : "text-muted-foreground";
                    const barTone =
                      score >= 75
                        ? "from-primary to-accent"
                        : score >= 45
                          ? "from-amber-glow to-amber-glow"
                          : "from-white/20 to-white/10";
                    return (
                      <div
                        key={label}
                        className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {label}
                          </div>
                          {val && (
                            <div className={`text-[10px] tabular-nums ${tone}`}>{score}%</div>
                          )}
                        </div>
                        <div className={val ? "text-foreground" : "text-muted-foreground/60"}>
                          {val ?? "—"}
                        </div>
                        {val && (
                          <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${barTone} transition-all`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {fields.validationSteps?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Validation steps
                    </h4>
                    <div className="space-y-1.5">
                      {fields.validationSteps.map((s) => {
                        const dot =
                          s.status === "pass"
                            ? "bg-accent"
                            : s.status === "warn"
                              ? "bg-amber-glow"
                              : "bg-red-400";
                        return (
                          <div
                            key={s.name}
                            className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs flex items-start gap-3"
                          >
                            <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-foreground">{s.name}</div>
                                <div className="text-[10px] tabular-nums text-muted-foreground">
                                  {s.score}%
                                </div>
                              </div>
                              <div className="text-muted-foreground mt-0.5">{s.detail}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {fields.notes && (
                  <p className="mt-3 text-[11px] text-muted-foreground">Notes: {fields.notes}</p>
                )}
                {ocrText && (
                  <details className="mt-3">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer">
                      Raw OCR text
                    </summary>
                    <pre className="mt-2 text-[11px] whitespace-pre-wrap text-muted-foreground max-h-40 overflow-auto rounded-lg bg-black/30 p-2">
                      {ocrText}
                    </pre>
                  </details>
                )}
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground inline-flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-glow" />
                  <div>
                    Ownership and encumbrance status cannot be verified without authorized Ministry
                    of Lands / Ardhisasa integration. Treat all extracted data as informational.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Map + intelligence */}
          <div className="min-w-0 space-y-4">
            <div className="glass-strong relative min-w-0 overflow-hidden rounded-3xl p-2">
              <MapView
                center={loc ? { lat: loc.lat, lng: loc.lng } : undefined}
                marker={loc ? { lat: loc.lat, lng: loc.lng, label: loc.address } : null}
                accuracyRadiusM={loc?.radiusM ?? null}
                zoom={loc ? 14 : 6}
                mapType="hybrid"
                theme="dark"
                className="rounded-[22px] h-[340px]"
              />
              {!loc && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                  <div className="glass rounded-full px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2 text-center">
                    <MapPin className="h-3.5 w-3.5 text-accent" />{" "}
                    {locIssue ?? "Parcel location will appear here"}
                  </div>
                </div>
              )}
            </div>
            {loc && (
              <>
                <div className="glass rounded-2xl px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="uppercase tracking-widest text-accent text-[10px] mr-2">
                    Approx. locality
                  </span>
                  {loc.address}
                  {loc.radiusM != null && (
                    <span className="mt-1.5 block text-[11px]">
                      The gold ring is how far this match could be out:{" "}
                      <span className="tabular-nums text-foreground">
                        {loc.radiusM >= 1000
                          ? `${(loc.radiusM / 1000).toFixed(1)} km`
                          : `${loc.radiusM} m`}
                      </span>{" "}
                      from the pin. The parcel is somewhere inside it, not at its centre.
                    </span>
                  )}
                  {loc.partialMatch && (
                    <span className="mt-1 block text-[11px] text-destructive">
                      Google matched only part of the location text on this record.
                    </span>
                  )}
                </div>
                <ParcelPin
                  origin={{ lat: loc.lat, lng: loc.lng }}
                  originLabel={loc.address}
                  originRadiusM={loc.radiusM}
                  onChange={setPinned}
                />
                <MutationUpload
                  onPlanChange={(plan, agreement) => setPlanRead({ plan, agreement })}
                  deed={{
                    // Whatever OCR already read off the deed, handed straight
                    // to the cross-check. Each is optional: a check only runs
                    // where both documents actually answered.
                    sheet: fields?.surveyNumber ?? null,
                    areaText: fields?.registeredArea ?? null,
                    block: fields?.titleNumber ?? fields?.lrNumber ?? null,
                  }}
                />
                <ParcelDraw
                  // Opens on the pin the user placed in Step 1 where there is
                  // one, falling back to the geocoded point. Drawing a
                  // boundary around a town centroid is not useful, so the pin
                  // is much the better centre when it exists.
                  center={{ lat: pinned?.lat ?? loc.lat, lng: pinned?.lng ?? loc.lng }}
                  deedAreaText={fields?.registeredArea ?? null}
                  onBoundaryChange={setBoundary}
                />
                <BuildBrief boundary={boundary} onBriefChange={setBriefState} />
                <button
                  type="button"
                  disabled={reporting}
                  onClick={async () => {
                    setReporting(true);
                    try {
                      await generateParcelReport({
                        reference:
                          fields?.titleNumber ||
                          fields?.lrNumber ||
                          fields?.parcelNumber ||
                          queryValue ||
                          null,
                        matchedAddress: loc.address,
                        geocoded: { lat: loc.lat, lng: loc.lng, radiusM: loc.radiusM },
                        pinned: pinned
                          ? { lat: pinned.lat, lng: pinned.lng, movedM: pinned.movedM }
                          : null,
                        boundary,
                        deedAreaText: fields?.registeredArea ?? null,
                        plan: planRead?.plan ?? null,
                        agreement: planRead?.agreement ?? null,
                        // Only sent once Step 4 has reported real figures. The
                        // report must never print setbacks nobody entered.
                        setbacks: briefState?.setbacks ?? null,
                        briefText: briefState?.briefText ?? null,
                      });
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setReporting(false);
                    }
                  }}
                  className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-medium text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {reporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Building the parcel report…
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" /> Download the parcel report
                    </>
                  )}
                </button>
                <LocationStatusCard
                  status={loc.status}
                  geocodeType={loc.gt}
                  source="Google Geocoding of the location text on the record"
                  reason="No surveyed parcel geometry is available for this title, so the pin marks the matched place, not the plot."
                  discrepancies={loc.discrepancy ? [loc.discrepancy] : []}
                  issues={loc.issues}
                />
                {locationMatch && (
                  <details
                    className="group rounded-2xl border border-foreground/10 bg-card/70 px-4 py-3 text-xs"
                    data-testid="deed-location-evidence"
                    open
                  >
                    <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-medium text-foreground">
                      <ScanSearch className="h-4 w-4 text-accent" aria-hidden="true" />
                      Place-match evidence
                      <span className="ml-auto font-mono text-accent">
                        {locationMatch.confidencePct}% · {locationMatch.band}
                      </span>
                    </summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Evidence used
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-foreground/85">
                          {locationMatch.evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Limits and next check
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                          {locationMatch.limitations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                          <li>
                            Confirm the parcel through an official search and a licensed surveyor.
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ListenButton
                        label="Listen to match evidence"
                        text={`Place match confidence ${locationMatch.confidencePct} percent, ${locationMatch.band}. Evidence: ${locationMatch.evidence.join(" ")} Limitations: ${locationMatch.limitations.join(" ")} Next: confirm the parcel through an official search and a licensed surveyor.`}
                      />
                    </div>
                  </details>
                )}
                <PassportLinks
                  target={{
                    // Once the user has placed a pin, everything downstream
                    // reads from the pin. It is the better point by a wide
                    // margin, and the source line below says where it came
                    // from so the distinction survives into the record.
                    lat: pinned?.lat ?? loc.lat,
                    lng: pinned?.lng ?? loc.lng,
                    ref:
                      fields?.titleNumber ||
                      fields?.lrNumber ||
                      fields?.parcelNumber ||
                      queryValue ||
                      "",
                    label: loc.address,
                    source: pinned
                      ? "Pin placed by the user on satellite imagery"
                      : "Google Geocoding of title record text",
                    status: pinned ? "user_provided" : loc.status,
                    gt: loc.gt,
                    county: loc.county ?? "",
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={downloadReport}
                    disabled={downloading}
                    className="glass-strong rounded-2xl px-3 py-3 text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-60"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Building…
                      </>
                    ) : (
                      <>
                        <FileDown className="h-4 w-4 text-accent" /> Download PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyShare}
                    className="glass-strong rounded-2xl px-3 py-3 text-xs font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition"
                    title={shareUrl}
                  >
                    {copiedShare ? (
                      <>
                        <Check className="h-4 w-4 text-accent" /> Link copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 text-accent" /> Copy share link
                      </>
                    )}
                  </button>
                </div>
                <Link
                  to="/report"
                  search={{
                    lat: loc.lat,
                    lng: loc.lng,
                    address: loc.address,
                    ref:
                      fields?.titleNumber ||
                      fields?.lrNumber ||
                      fields?.parcelNumber ||
                      queryValue ||
                      "",
                  }}
                  target="_blank"
                  rel="noopener"
                  className="text-[11px] text-muted-foreground hover:text-accent inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Open shareable view
                </Link>
                <div className="min-w-0 overflow-hidden">
                  <IntelligenceDashboard lat={loc.lat} lng={loc.lng} address={loc.address} />
                </div>
              </>
            )}

            <HistoryPanel
              items={history.items}
              onOpen={replayEntry}
              onRemove={history.remove}
              onClear={history.clear}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  items,
  onOpen,
  onRemove,
  onClear,
}: {
  items: DeedHistoryEntry[];
  onOpen: (e: DeedHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2 uppercase tracking-widest text-[10px] text-accent">
          <History className="h-3.5 w-3.5" /> History
        </div>
        <p className="mt-2">Your title deed searches and uploads will appear here.</p>
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2 uppercase tracking-widest text-[10px] text-accent">
          <History className="h-3.5 w-3.5" /> History · {items.length}
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
      <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
        {items.map((e) => (
          <li key={e.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onOpen(e)}
                className="flex-1 min-w-0 text-left"
                disabled={e.mode !== "query"}
                title={e.mode === "query" ? "Re-run this search" : "Uploaded document"}
              >
                <div className="text-foreground truncate">{e.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.fields?.confidence != null && (
                    <span className="ml-2 text-accent">· {e.fields.confidence}%</span>
                  )}
                  {e.fields?.county && <span className="ml-2">· {e.fields.county}</span>}
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {e.location && (
                  <Link
                    to="/report"
                    search={{
                      lat: e.location.lat,
                      lng: e.location.lng,
                      address: e.location.address,
                      ref:
                        e.fields?.titleNumber ||
                        e.fields?.lrNumber ||
                        e.fields?.parcelNumber ||
                        e.queryValue ||
                        "",
                    }}
                    target="_blank"
                    rel="noopener"
                    className="glass rounded-full p-1.5 hover:text-accent"
                    title="Open report"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <button
                  onClick={() => onRemove(e.id)}
                  className="glass rounded-full p-1.5 hover:text-red-400"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
