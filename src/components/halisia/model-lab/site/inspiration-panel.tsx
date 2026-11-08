/**
 * "Your design inspiration": the client adds photos, a video or a link of a
 * house they like, HALISIA reads its design language, and the 3D house takes
 * that roof form, wall finish, window size, interior mood and colours.
 *
 * Colours are always read on the device. With sign-in, AI also reads the
 * pictures (and fetches the picture behind a link). Every choice stays
 * editable. The result is "inspired by", never a copy or a drawing.
 */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Sparkles, Video, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { readDesignInspiration } from "@/lib/design-inspiration.functions";
import { MAX_INSPIRATION_IMAGES } from "@/lib/design-inspiration";
import {
  DEFAULT_STYLE,
  CEILING_LABEL,
  CEILING_TYPES,
  FLOOR_FINISHES,
  FLOOR_LABEL,
  INTERIOR_LABEL,
  INTERIOR_MOODS,
  LIGHTING_LABEL,
  LIGHTING_TYPES,
  ROOF_FORMS,
  ROOF_LABEL,
  WALL_FINISHES,
  WALL_LABEL,
  WINDOW_LABEL,
  WINDOW_SIZES,
  clearInspiration,
  extractPalette,
  loadInspiration,
  saveInspiration,
  styleFromPalette,
  type DesignStyle,
  type PaletteColour,
} from "./design-style";

type Pic = { id: string; dataUrl: string; label: string };

const MAX_SIDE = 1024;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This picture could not be opened."));
    img.src = src;
  });
}

/** Any picture the browser can open → a JPEG data URL no larger than 1024 px. */
async function toJpeg(src: CanvasImageSource, w: number, h: number, quality = 0.82) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
  const g = cv.getContext("2d");
  if (!g) throw new Error("This browser cannot read pictures.");
  g.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", quality);
}

async function fileToJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    return await toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Three still frames from a video (at 20%, 50% and 80%), read on the device. */
async function videoFrames(file: File): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  const wait = (ev: string) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("The video took too long to open.")), 15_000);
      v.addEventListener(
        ev,
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
      v.addEventListener(
        "error",
        () => {
          clearTimeout(t);
          reject(new Error("This video format cannot be read here. Try a photo of it instead."));
        },
        { once: true },
      );
    });
  try {
    await wait("loadeddata");
    const out: string[] = [];
    for (const f of [0.2, 0.5, 0.8]) {
      v.currentTime = Math.max(0, (v.duration || 1) * f);
      await wait("seeked");
      out.push(await toJpeg(v, v.videoWidth, v.videoHeight, 0.78));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Main colours of a set of pictures, read on a 96 px copy of each. */
async function paletteOf(pics: string[]): Promise<PaletteColour[]> {
  const all: number[] = [];
  for (const src of pics) {
    const img = await loadImg(src);
    const cv = document.createElement("canvas");
    cv.width = 96;
    cv.height = 96;
    const g = cv.getContext("2d");
    if (!g) continue;
    g.drawImage(img, 0, 0, 96, 96);
    const d = g.getImageData(0, 0, 96, 96).data;
    for (let i = 0; i < d.length; i++) all.push(d[i]);
  }
  return extractPalette(all, 6);
}

async function thumbOf(src: string): Promise<string | null> {
  try {
    const img = await loadImg(src);
    const k = 160 / Math.max(img.naturalWidth, img.naturalHeight);
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    cv.getContext("2d")?.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

let picSeq = 0;

export function InspirationPanel({
  value,
  onApply,
  testId = "inspiration",
}: {
  /** The style the house uses now (null = HALISIA default). */
  value: DesignStyle | null;
  onApply: (style: DesignStyle | null) => void;
  testId?: string;
}) {
  const { user } = useAuth();
  const [pics, setPics] = useState<Pic[]>([]);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteColour[]>([]);
  const [savedThumb, setSavedThumb] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const style = value ?? DEFAULT_STYLE;

  useEffect(() => {
    const stored = loadInspiration();
    if (stored) {
      setSavedThumb(stored.thumb);
      if (!value) onApply(stored.style);
    }
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const room = MAX_INSPIRATION_IMAGES - pics.length;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setMessage(null);
    setBusy("Opening your pictures…");
    try {
      const add: Pic[] = [];
      for (const f of Array.from(files).slice(0, Math.max(0, room))) {
        add.push({ id: `p${++picSeq}`, dataUrl: await fileToJpeg(f), label: f.name });
      }
      if (files.length > room)
        setMessage(
          `Only ${MAX_INSPIRATION_IMAGES} pictures are read at a time; the rest were left out.`,
        );
      setPics((p) => [...p, ...add]);
    } catch (e) {
      setMessage(
        `${(e as Error).message} iPhone HEIC photos may need sharing as JPEG ("Most Compatible").`,
      );
    } finally {
      setBusy(null);
    }
  };

  const addVideo = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setMessage(null);
    setBusy("Taking still frames from your video…");
    try {
      const frames = await videoFrames(f);
      setPics((p) =>
        [
          ...p,
          ...frames.map((d, i) => ({
            id: `v${++picSeq}`,
            dataUrl: d,
            label: `${f.name} · frame ${i + 1}`,
          })),
        ].slice(0, MAX_INSPIRATION_IMAGES),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const read = async () => {
    setMessage(null);
    const images = pics.map((p) => p.dataUrl);
    const trimmed = link.trim();
    if (!images.length && !trimmed) {
      setMessage("Add a photo, a video or a link first.");
      return;
    }
    let next: DesignStyle = { ...style };
    let thumbSrc: string | null = images[0] ?? null;
    try {
      if (images.length) {
        setBusy("Reading the colours…");
        const pal = await paletteOf(images);
        setPalette(pal);
        next = styleFromPalette(pal, { ...style, notes: [] });
      }
      if (!user) {
        setMessage(
          trimmed && !images.length
            ? "Sign in to read a link. You can also save the picture and add it as a photo."
            : "Colours read on your device. Sign in to let HALISIA AI also read the roof, walls, windows and interior style.",
        );
      } else {
        setBusy("HALISIA AI is reading the design…");
        const res = await readDesignInspiration({
          data: { images, link: trimmed || null, note },
        });
        if (res.linkImage) {
          thumbSrc = thumbSrc ?? res.linkImage;
          const linkImage = res.linkImage;
          setPics((p) =>
            p.some((x) => x.dataUrl === linkImage)
              ? p
              : [...p, { id: `l${++picSeq}`, dataUrl: linkImage, label: "From your link" }].slice(
                  0,
                  MAX_INSPIRATION_IMAGES,
                ),
          );
          if (!images.length) {
            const pal = await paletteOf([res.linkImage]);
            setPalette(pal);
            next = styleFromPalette(pal, { ...style, notes: [] });
          }
        }
        if (res.ok) {
          next = res.style;
          if (!res.isBuilding)
            setMessage(
              "That does not look like a building or a room, so treat this style as a rough guess.",
            );
        } else setMessage(res.message);
      }
      if (next.source === "default") next = { ...next, source: "colours" };
      onApply(next);
      const thumb = thumbSrc ? await thumbOf(thumbSrc) : null;
      setSavedThumb(thumb);
      saveInspiration(next, thumb);
    } catch (e) {
      setMessage((e as Error).message || "The inspiration could not be read.");
    } finally {
      setBusy(null);
    }
  };

  const edit = (patch: Partial<DesignStyle>) => {
    const next = { ...style, ...patch, source: "manual" as const };
    onApply(next);
    saveInspiration(next, savedThumb);
  };

  const reset = () => {
    clearInspiration();
    setPics([]);
    setPalette([]);
    setSavedThumb(null);
    setLink("");
    setNote("");
    setMessage(null);
    onApply(null);
  };

  const chip = "min-h-11 rounded-full border px-4 text-sm font-medium";

  return (
    <section
      aria-labelledby={`${testId}-title`}
      className="rounded-2xl border border-border bg-card p-4 text-sm"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-60">
          <h2 id={`${testId}-title`} className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> Your design inspiration
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Show HALISIA a house you like: photos, a short video or a link (Pinterest, Instagram,
            YouTube, a website). Your 3D house takes its roof, walls, windows, colours and interior
            feel.
          </p>
        </div>
        {value && value.source !== "default" && (
          <button type="button" onClick={reset} className={`${chip} border-border`}>
            Use HALISIA default
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`${chip} inline-flex items-center gap-2 border-accent/50`}
          onClick={() => photoRef.current?.click()}
          disabled={!!busy || room <= 0}
          data-testid={`${testId}-add-photo`}
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" /> Add photos
        </button>
        <button
          type="button"
          className={`${chip} inline-flex items-center gap-2 border-accent/50`}
          onClick={() => videoRef.current?.click()}
          disabled={!!busy || room <= 0}
        >
          <Video className="h-4 w-4" aria-hidden="true" /> Add a video
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Choose inspiration photos"
          onChange={(e) => {
            void addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          aria-label="Choose an inspiration video"
          onChange={(e) => {
            void addVideo(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <label className="mt-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Link to a design you like</span>
        <input
          type="url"
          inputMode="url"
          placeholder="Paste a link to a house you like"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3"
          data-testid={`${testId}-link`}
        />
      </label>
      <label className="mt-2 block">
        <span className="text-xs text-muted-foreground">
          Anything to keep? (optional, e.g. &ldquo;stone walls, big windows, flat roof&rdquo;)
        </span>
        <input
          type="text"
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
        />
      </label>

      {pics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your inspiration pictures">
          {pics.map((p) => (
            <li key={p.id} className="relative">
              <img
                src={p.dataUrl}
                alt={p.label}
                className="h-20 w-28 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${p.label}`}
                onClick={() => setPics((all) => all.filter((x) => x.id !== p.id))}
                className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void read()}
        disabled={!!busy}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        data-testid={`${testId}-read`}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {busy ?? "Read my inspiration"}
      </button>
      {(!value || value.source === "default") && (
        <button
          type="button"
          onClick={() => edit({})}
          className="ml-2 mt-3 min-h-11 rounded-full border border-border px-4 text-sm"
          data-testid={`${testId}-manual`}
        >
          Choose the style by hand
        </button>
      )}
      {!user && (
        <p className="mt-2 text-xs text-muted-foreground">
          Without signing in, HALISIA reads the colours on your device.{" "}
          <Link to="/auth" className="underline">
            Sign in
          </Link>{" "}
          to let AI read the whole design and links.
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-xs">
          {message}
        </p>
      )}

      {value && value.source !== "default" && (
        <div className="mt-4 border-t border-border pt-3" data-testid={`${testId}-result`}>
          <div className="flex items-center gap-3">
            {savedThumb && (
              <img
                src={savedThumb}
                alt="Your inspiration"
                className="h-12 w-16 rounded-md object-cover"
              />
            )}
            <p className="text-xs font-semibold">
              {value.source === "ai"
                ? "Read by HALISIA AI. Change anything below."
                : value.source === "colours"
                  ? "Colours read from your pictures. Pick the rest below."
                  : "Your choices"}
            </p>
          </div>
          {value.notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {value.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ChoiceGroup
              label="Roof"
              options={ROOF_FORMS.map((r) => [r, ROOF_LABEL[r]])}
              value={style.roof}
              onChange={(v) => edit({ roof: v as DesignStyle["roof"] })}
            />
            <ChoiceGroup
              label="Outside walls"
              options={WALL_FINISHES.map((w) => [w, WALL_LABEL[w]])}
              value={style.wall}
              onChange={(v) => edit({ wall: v as DesignStyle["wall"] })}
            />
            <ChoiceGroup
              label="Windows"
              options={WINDOW_SIZES.map((w) => [w, WINDOW_LABEL[w]])}
              value={style.windows}
              onChange={(v) => edit({ windows: v as DesignStyle["windows"] })}
            />
            <ChoiceGroup
              label="Inside feel"
              options={INTERIOR_MOODS.map((m) => [m, INTERIOR_LABEL[m]])}
              value={style.interior}
              onChange={(v) => edit({ interior: v as DesignStyle["interior"] })}
            />
            <ChoiceGroup
              label="Ceiling"
              options={CEILING_TYPES.map((c) => [c, CEILING_LABEL[c]])}
              value={style.ceiling}
              onChange={(v) => edit({ ceiling: v as DesignStyle["ceiling"] })}
            />
            <ChoiceGroup
              label="Lighting"
              options={LIGHTING_TYPES.map((c) => [c, LIGHTING_LABEL[c]])}
              value={style.lighting}
              onChange={(v) => edit({ lighting: v as DesignStyle["lighting"] })}
            />
            <ChoiceGroup
              label="Floors"
              options={FLOOR_FINISHES.map((c) => [c, FLOOR_LABEL[c]])}
              value={style.floor}
              onChange={(v) => edit({ floor: v as DesignStyle["floor"] })}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {(
              [
                ["wallColor", "Wall colour"],
                ["roofColor", "Roof colour"],
                ["trimColor", "Window frames"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs">
                <input
                  type="color"
                  value={style[key]}
                  onChange={(e) => edit({ [key]: e.target.value } as Partial<DesignStyle>)}
                  className="h-11 w-11 cursor-pointer rounded-lg border border-border bg-transparent"
                  aria-label={label}
                />
                {label}
              </label>
            ))}
          </div>
          {palette.length > 0 && (
            <div className="mt-3" aria-label="Colours found in your pictures">
              <p className="text-xs text-muted-foreground">
                Colours in your pictures (tap to use for walls):
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {palette.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => edit({ wallColor: c.hex })}
                    className="h-9 w-9 rounded-full border border-border"
                    style={{ background: c.hex }}
                    aria-label={`Use ${c.hex} for the walls`}
                    title={c.hex}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Inspired by your pictures, not a copy of that building and not an architect&apos;s
            drawing. Room layout, sizes and costs still follow HALISIA&apos;s house types.
          </p>
        </div>
      )}
    </section>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
            className={`min-h-11 rounded-full border px-3 text-xs ${
              value === id ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
