/**
 * Hardened GLB byte loader for the Model Lab.
 *
 * Responsibilities: URL validation, HEAD probe with graceful fallback when
 * HEAD is rejected, single download (never twice), determinate progress when
 * Content-Length exists, timeout, bounded retry, abort, in-flight
 * deduplication and a bounded cache. Parsing happens in the viewer via
 * GLTFLoader.parse on the bytes returned here.
 */
import { isAllowedModelUrl } from "./device";

export type LoadState =
  | "IDLE"
  | "CHECKING"
  | "DOWNLOADING"
  | "PARSING"
  | "READY"
  | "FAILED_NETWORK"
  | "FAILED_ASSET"
  | "FAILED_WEBGL"
  | "UNSUPPORTED_DEVICE"
  | "AR_UNAVAILABLE";

export type LoadProgress = {
  state: Extract<LoadState, "CHECKING" | "DOWNLOADING" | "PARSING">;
  /** 0–1 when determinate, null when the server gave no Content-Length. */
  ratio: number | null;
  loadedBytes: number;
  totalBytes: number | null;
};

export class GlbLoadError extends Error {
  readonly state: Extract<LoadState, "FAILED_NETWORK" | "FAILED_ASSET">;
  readonly url: string;
  constructor(
    state: "FAILED_NETWORK" | "FAILED_ASSET",
    url: string,
    message: string,
  ) {
    super(message);
    this.name = "GlbLoadError";
    this.state = state;
    this.url = url;
  }
}

const GLB_MAGIC = 0x46546c67; // "glTF" little-endian

export function isGlbMagicValid(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 12) return false;
  return new DataView(buffer).getUint32(0, true) === GLB_MAGIC;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LoadOptions = {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  onProgress?: (p: LoadProgress) => void;
  fetchImpl?: FetchLike;
};

/** Bounded LRU cache of downloaded GLB bytes. */
export class GlbCache {
  private readonly max: number;
  private readonly map = new Map<string, ArrayBuffer>();
  constructor(max = 2) {
    this.max = Math.max(1, max);
  }
  get(url: string): ArrayBuffer | undefined {
    const hit = this.map.get(url);
    if (hit) {
      this.map.delete(url);
      this.map.set(url, hit);
    }
    return hit;
  }
  set(url: string, buf: ArrayBuffer): void {
    if (this.map.has(url)) this.map.delete(url);
    this.map.set(url, buf);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
  get size(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
}

function linkSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onAbort = () => ctrl.abort();
  if (external) {
    if (external.aborted) ctrl.abort();
    else external.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
    timedOut: () => timedOut,
  };
}

/**
 * HEAD probe for Content-Length. A 405, or a 403 that signals method
 * rejection, is not an error — the caller simply proceeds with a GET and
 * indeterminate progress. The asset is never downloaded twice.
 */
export async function probeContentLength(
  url: string,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const res = await fetchImpl(url, { method: "HEAD", signal });
    if (res.status === 405 || res.status === 403 || res.status === 501) return null;
    if (!res.ok) return null;
    const len = res.headers?.get?.("content-length");
    const n = len ? Number(len) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function downloadOnce(
  url: string,
  opts: Required<Pick<LoadOptions, "timeoutMs">> & LoadOptions,
): Promise<ArrayBuffer> {
  const fetchImpl = opts.fetchImpl ?? ((i: string, x?: RequestInit) => fetch(i, x));
  const { signal, cleanup, timedOut } = linkSignals(opts.signal, opts.timeoutMs);
  try {
    opts.onProgress?.({ state: "CHECKING", ratio: null, loadedBytes: 0, totalBytes: null });
    const headLength = await probeContentLength(url, fetchImpl, signal);

    const res = await fetchImpl(url, { method: "GET", signal });
    if (res.status === 404) {
      throw new GlbLoadError(
        "FAILED_ASSET",
        url,
        `Asset not found (HTTP 404): ${url}. The GLB file has not been added to public/_model-lab/ yet.`,
      );
    }
    if (!res.ok) {
      throw new GlbLoadError("FAILED_NETWORK", url, `HTTP ${res.status} while fetching ${url}.`);
    }

    const headerLength = Number(res.headers?.get?.("content-length") ?? NaN);
    const total = Number.isFinite(headerLength) && headerLength > 0 ? headerLength : headLength;

    let buffer: ArrayBuffer;
    const body = (res as Response).body;
    if (body && typeof body.getReader === "function") {
      const reader = body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          opts.onProgress?.({
            state: "DOWNLOADING",
            ratio: total ? Math.min(1, loaded / total) : null,
            loadedBytes: loaded,
            totalBytes: total ?? null,
          });
        }
      }
      const merged = new Uint8Array(loaded);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      buffer = merged.buffer;
    } else {
      opts.onProgress?.({
        state: "DOWNLOADING",
        ratio: null,
        loadedBytes: 0,
        totalBytes: total ?? null,
      });
      buffer = await res.arrayBuffer();
      opts.onProgress?.({
        state: "DOWNLOADING",
        ratio: 1,
        loadedBytes: buffer.byteLength,
        totalBytes: total ?? buffer.byteLength,
      });
    }

    if (!isGlbMagicValid(buffer)) {
      throw new GlbLoadError(
        "FAILED_ASSET",
        url,
        `${url} did not return a valid binary glTF (missing glTF magic header).`,
      );
    }
    return buffer;
  } catch (err) {
    if (err instanceof GlbLoadError) throw err;
    if (timedOut()) {
      throw new GlbLoadError("FAILED_NETWORK", url, `Timed out after ${opts.timeoutMs} ms fetching ${url}.`);
    }
    if ((err as Error)?.name === "AbortError") throw err;
    throw new GlbLoadError(
      "FAILED_NETWORK",
      url,
      `Network error fetching ${url}: ${(err as Error)?.message ?? "unknown error"}`,
    );
  } finally {
    cleanup();
  }
}

const inFlight = new Map<string, Promise<ArrayBuffer>>();
export const glbCache = new GlbCache(2);

/**
 * Load GLB bytes with cache, dedupe, timeout and bounded retry.
 * FAILED_ASSET (404 / bad magic) is never retried — retrying cannot fix it.
 */
export async function loadGlbBytes(url: string, opts: LoadOptions = {}): Promise<ArrayBuffer> {
  if (!isAllowedModelUrl(url)) {
    throw new GlbLoadError("FAILED_ASSET", url, `Blocked model URL (HTTPS or same-origin only): ${url}`);
  }
  const cached = glbCache.get(url);
  if (cached) return cached;

  const existing = inFlight.get(url);
  if (existing) return existing;

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = Math.max(0, opts.retries ?? 2);

  const run = (async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const buf = await downloadOnce(url, { ...opts, timeoutMs });
        glbCache.set(url, buf);
        return buf;
      } catch (err) {
        lastErr = err;
        if (err instanceof GlbLoadError && err.state === "FAILED_ASSET") break;
        if ((err as Error)?.name === "AbortError") break;
        if (opts.signal?.aborted) break;
      }
    }
    throw lastErr;
  })().finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, run);
  return run;
}

/** Test/reset helper. */
export function resetLoaderState(): void {
  inFlight.clear();
  glbCache.clear();
}

export function inFlightCount(): number {
  return inFlight.size;
}

export function humanBytes(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return "unknown size";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
