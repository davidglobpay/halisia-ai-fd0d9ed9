/**
 * Client-side media cache for Pulse rails.
 *
 * - Images are prefetched with `AbortController` so a card that scrolls away
 *   cancels its own request instead of wasting bandwidth.
 * - Failures retry with exponential backoff (capped), then surface an error so
 *   the UI can offer a one-click retry.
 * - Generated audio is cached per article + engine, so revisiting a rail never
 *   pays for a duplicate TTS call.
 */

export type MediaState = "idle" | "loading" | "ready" | "error";

type ImageEntry = {
  state: MediaState;
  promise?: Promise<void>;
  controller?: AbortController;
  attempts: number;
};

const images = new Map<string, ImageEntry>();

const BACKOFF_MS = [400, 1200, 3000];

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** True when the image has already been fetched successfully this session. */
export function imageIsCached(url: string): boolean {
  return images.get(url)?.state === "ready";
}

export function imageState(url: string): MediaState {
  return images.get(url)?.state ?? "idle";
}

/** Cancel an in-flight prefetch (card left the viewport). */
export function cancelImagePrefetch(url: string) {
  const entry = images.get(url);
  if (entry?.state === "loading") {
    entry.controller?.abort();
    images.delete(url);
  }
}

/**
 * Prefetch and decode an image with retry/backoff. Resolves once the bitmap is
 * in the browser cache; rejects after the final attempt fails.
 */
export function prefetchImage(url: string, opts: { retry?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const existing = images.get(url);
  if (existing?.state === "ready") return Promise.resolve();
  if (existing?.state === "loading" && existing.promise) return existing.promise;
  if (existing?.state === "error" && !opts.retry) return Promise.reject(new Error("image failed"));

  const controller = new AbortController();
  const entry: ImageEntry = { state: "loading", controller, attempts: 0 };
  images.set(url, entry);

  const run = async () => {
    let lastError: unknown;
    for (let i = 0; i <= BACKOFF_MS.length; i++) {
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      entry.attempts = i + 1;
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.decoding = "async";
          const onAbort = () => {
            img.src = "";
            reject(new DOMException("Aborted", "AbortError"));
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("image error"));
          img.src = url;
        });
        entry.state = "ready";
        return;
      } catch (err) {
        lastError = err;
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        if (i < BACKOFF_MS.length) await wait(BACKOFF_MS[i]!, controller.signal);
      }
    }
    entry.state = "error";
    throw lastError instanceof Error ? lastError : new Error("image failed");
  };

  const promise = run().catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") {
      images.delete(url);
    } else {
      entry.state = "error";
    }
    throw err;
  });
  entry.promise = promise;
  return promise;
}

/* ------------------------------ audio cache ------------------------------ */

export type CachedAudio = { engine: string; mimeType: string; audioBase64: string };

const audio = new Map<string, CachedAudio>();
const audioInFlight = new Map<string, Promise<CachedAudio>>();

const audioKey = (articleId: string, engine: string) => `${articleId}::${engine}`;

export function getCachedAudio(articleId: string, engine: string): CachedAudio | undefined {
  return audio.get(audioKey(articleId, engine));
}

/**
 * Resolve audio for an article, reusing the cache and de-duplicating parallel
 * requests for the same article + engine.
 */
export function loadAudio(
  articleId: string,
  engine: string,
  fetcher: () => Promise<CachedAudio>,
): Promise<CachedAudio> {
  const key = audioKey(articleId, engine);
  const hit = audio.get(key);
  if (hit) return Promise.resolve(hit);
  const flight = audioInFlight.get(key);
  if (flight) return flight;
  const p = fetcher()
    .then((res) => {
      audio.set(key, res);
      return res;
    })
    .finally(() => audioInFlight.delete(key));
  audioInFlight.set(key, p);
  return p;
}

/** Warm the browser speech engine once so the first tap has no cold start. */
let voicesWarmed = false;
export function warmSpeechEngine() {
  if (voicesWarmed || typeof window === "undefined") return;
  voicesWarmed = true;
  window.speechSynthesis?.getVoices();
}
