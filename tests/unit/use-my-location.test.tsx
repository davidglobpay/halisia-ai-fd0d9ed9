import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMyLocation, type MyLocation } from "@/hooks/use-my-location";
import { distanceMeters } from "@/lib/spatial";

type WatchCb = (pos: GeolocationPosition) => void;
type ErrCb = (err: GeolocationPositionError) => void;

function fakePosition(lat: number, lng: number, accuracy = 10): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function fakeError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

describe("useMyLocation", () => {
  let watchCb: WatchCb | null = null;
  let watchErrCb: ErrCb | null = null;
  let nextWatchId = 42;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((cb: WatchCb, errCb?: ErrCb) => {
    watchCb = cb;
    watchErrCb = errCb ?? null;
    return nextWatchId++;
  });

  beforeEach(() => {
    watchCb = null;
    watchErrCb = null;
    nextWatchId = 42;
    clearWatch.mockClear();
    watchPosition.mockClear();
    Object.defineProperty(globalThis.navigator, "geolocation", {
      value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits initial location on first watchPosition update", () => {
    const { result } = renderHook(() => useMyLocation());
    const updates: MyLocation[] = [];
    act(() => {
      result.current.watch((v) => updates.push(v));
    });
    act(() => {
      watchCb?.(fakePosition(-1.2921, 36.8219));
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].lat).toBeCloseTo(-1.2921, 4);
    expect(updates[0].lng).toBeCloseTo(36.8219, 4);
  });

  it("suppresses jitter under 50m by smoothing (haversine distance)", () => {
    const { result } = renderHook(() => useMyLocation());
    const updates: MyLocation[] = [];
    act(() => {
      result.current.watch((v) => updates.push(v));
    });
    // First fix
    act(() => watchCb?.(fakePosition(-1.2921, 36.8219)));
    // Jitter: ~11m north (0.0001 deg lat ≈ 11.1m) — below 50m
    act(() => watchCb?.(fakePosition(-1.29199, 36.8219)));
    expect(updates).toHaveLength(2);
    const jump = distanceMeters(updates[0], updates[1]);
    // Smoothing (0.35 factor) keeps the applied jump strictly smaller than the raw jitter
    expect(jump).toBeLessThan(11);
    expect(jump).toBeGreaterThan(0);
  });

  it("accepts real movement over 50m without smoothing", () => {
    const { result } = renderHook(() => useMyLocation());
    const updates: MyLocation[] = [];
    act(() => {
      result.current.watch((v) => updates.push(v));
    });
    act(() => watchCb?.(fakePosition(-1.2921, 36.8219)));
    // 200m jump north
    act(() => watchCb?.(fakePosition(-1.2903, 36.8219)));
    const applied = distanceMeters(updates[0], updates[1]);
    expect(applied).toBeGreaterThan(150);
  });

  it("clears watchPosition on unmount", () => {
    const { result, unmount } = renderHook(() => useMyLocation());
    act(() => {
      result.current.watch();
    });
    expect(watchPosition).toHaveBeenCalledTimes(1);
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it("restarting watch() releases the previous watcher before subscribing again", () => {
    const { result, unmount } = renderHook(() => useMyLocation());
    act(() => {
      result.current.watch();
    });
    act(() => {
      result.current.watch();
    });
    expect(watchPosition).toHaveBeenCalledTimes(2);
    // The first watcher (id 42) was cleared before the second subscription (id 43).
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(true);
    unmount();
    // Unmount clears the *current* watcher (43), proving only one is active.
    expect(clearWatch).toHaveBeenCalledWith(43);
  });

  it("the returned stop function releases the watcher deterministically", () => {
    const { result } = renderHook(() => useMyLocation());
    let stopFn: (() => void) | undefined;
    act(() => {
      stopFn = result.current.watch();
    });
    expect(result.current.watching).toBe(true);
    act(() => stopFn?.());
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(false);
    // Idempotent: stopping twice does not clear anything else.
    act(() => stopFn?.());
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });

  it("permission-denied error stops the watch and clears the watcher", () => {
    const { result } = renderHook(() => useMyLocation());
    act(() => {
      result.current.watch();
    });
    expect(result.current.watching).toBe(true);
    act(() => watchErrCb?.(fakeError(1, "User denied Geolocation")));
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(false);
    expect(result.current.error).toBe("User denied Geolocation");
  });

  it("transient errors keep the watcher alive but surface the error", () => {
    const { result } = renderHook(() => useMyLocation());
    act(() => {
      result.current.watch();
    });
    act(() => watchErrCb?.(fakeError(3, "Timeout expired")));
    expect(clearWatch).not.toHaveBeenCalled();
    expect(result.current.watching).toBe(true);
    expect(result.current.error).toBe("Timeout expired");
  });

  it("simulate() stops an active watch so GPS cannot overwrite the manual pin", () => {
    const { result } = renderHook(() => useMyLocation());
    act(() => {
      result.current.watch();
    });
    expect(result.current.watching).toBe(true);
    act(() => result.current.simulate({ lat: 1, lng: 2 }));
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(result.current.watching).toBe(false);
    expect(result.current.location).toEqual({ lat: 1, lng: 2 });
    expect(result.current.simulated).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
