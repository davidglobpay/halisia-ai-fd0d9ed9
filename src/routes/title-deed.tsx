import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { Navbar } from "@/components/halisia/navbar";
import { MapView } from "@/components/halisia/map-view";
import { IntelligenceDashboard } from "@/components/halisia/intelligence-dashboard";
import { extractDeedFields, type DeedFields } from "@/lib/deed-extract.functions";
import { geocodeAddress } from "@/lib/geocode.functions";
import { generateLocationDossier } from "@/lib/pdf-dossier";
import { useDeedHistory, type DeedHistoryEntry } from "@/hooks/use-deed-history";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/title-deed")({
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
  const [loc, setLoc] = useState<{ lat: number; lng: number; address: string } | null>(null);
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
        const parts = [extracted.locationHint, extracted.registry, extracted.county]
          .filter(Boolean)
          .join(", ");
        const geoQuery = parts || extracted.county || extracted.registry || "";
        let located: { lat: number; lng: number; address: string } | null = null;
        if (geoQuery) {
          try {
            const res = await geocodeAddress({ data: { query: geoQuery } });
            if (res.ok) {
              located = { lat: res.lat, lng: res.lng, address: res.address };
              setLoc(located);
            }
          } catch (err) {
            console.warn("locate failed", err);
          }
        }
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
    const ref =
      fields?.titleNumber || fields?.lrNumber || fields?.parcelNumber || queryValue || "";
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
    const parts = [f.locationHint, f.registry, f.county].filter(Boolean).join(", ");
    const query = parts || f.county || f.registry || "";
    if (!query) return;
    try {
      const res = await geocodeAddress({ data: { query } });
      if (res.ok) setLoc({ lat: res.lat, lng: res.lng, address: res.address });
    } catch (e) {
      console.warn("locate failed", e);
    }
  }, []);

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
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Processing failed");
      setStage("error");
    }
  };

  const processQuery = async () => {
    if (!queryValue.trim()) return;
    setError(null);
    setStage("extract");
    setProgressMsg("Interpreting reference…");
    try {
      // Synthesize minimal OCR-like text so the AI can normalize + guess a locality.
      const label =
        queryType === "title"
          ? "Title Number"
          : queryType === "lr"
            ? "L.R. Number"
            : queryType === "parcel"
              ? "Parcel Number"
              : "Registry";
      const synthetic = `${label}: ${queryValue.trim()}`;
      const extracted = await extractDeedFields({ data: { text: synthetic } });
      setFields(extracted);
      setOcrText(synthetic);
      await locateFrom(extracted);
      setStage("done");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Search failed");
      setStage("error");
    }
  };

  const downloadReport = async () => {
    if (!loc) return;
    setDownloading(true);
    try {
      await generateLocationDossier({ lat: loc.lat, lng: loc.lng, address: loc.address });
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const busy = stage === "ocr" || stage === "extract" || stage === "locate";

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 mx-auto max-w-[1400px] px-4">
        <header className="max-w-3xl">
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

        <div className="mt-4 grid lg:grid-cols-[1fr_420px] gap-4">
          {/* LEFT: Input surface */}
          <div className="glass-strong rounded-3xl p-5">
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
                <div className="flex gap-2">
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
                    className="flex-1 rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-accent/60"
                  />
                  <button
                    onClick={processQuery}
                    disabled={!queryValue.trim() || busy}
                    className="rounded-2xl px-4 py-3 text-sm bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanSearch className="h-4 w-4" />
                    )}
                    Analyze
                  </button>
                </div>
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
                      ["Title No.", fields.titleNumber],
                      ["L.R. No.", fields.lrNumber],
                      ["Parcel No.", fields.parcelNumber],
                      ["Registry", fields.registry],
                      ["County", fields.county],
                      ["Registered area", fields.registeredArea],
                      ["Survey No.", fields.surveyNumber],
                      ["Lease term", fields.leaseTerm],
                      ["Registered date", fields.registrationDate],
                      ["Registered owner", fields.registeredOwner],
                      ["Locality hint", fields.locationHint],
                    ] as const
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {label}
                      </div>
                      <div className={val ? "text-foreground" : "text-muted-foreground/60"}>
                        {val ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
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
          <div className="space-y-4">
            <div className="glass-strong rounded-3xl p-2 relative">
              <MapView
                center={loc ? { lat: loc.lat, lng: loc.lng } : undefined}
                marker={loc ? { lat: loc.lat, lng: loc.lng, label: loc.address } : null}
                zoom={loc ? 14 : 6}
                mapType="hybrid"
                theme="dark"
                className="rounded-[22px] h-[340px]"
              />
              {!loc && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="glass rounded-full px-4 py-2 text-xs text-muted-foreground inline-flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-accent" /> Parcel location will appear here
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
                </div>
                <button
                  onClick={downloadReport}
                  disabled={downloading}
                  className="w-full glass-strong rounded-2xl px-4 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-white/10 transition disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Building report…
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4 text-accent" /> Download land intelligence report
                    </>
                  )}
                </button>
                <IntelligenceDashboard lat={loc.lat} lng={loc.lng} address={loc.address} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
