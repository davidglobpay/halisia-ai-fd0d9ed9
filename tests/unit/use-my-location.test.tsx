import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMyLocation, type MyLocation } from "@/hooks/use-my-location";

type WatchCb = (pos: GeolocationPosition) => void;

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

describe("useMyLocation", () => {
  let watchCb: WatchCb | null = null;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((cb: WatchCb) => {
    watchCb = cb;
    return 42;
  });

  beforeEach(() => {
    watchCb = null;
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

  it("suppresses jitter under 50m by smoothing", () => {
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
    const jump = Math.hypot(updates[1].lat - updates[0].lat, updates[1].lng - updates[0].lng) * 111_320;
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
    act(() => watchCb?.(fakePosition(-1.29030, 36.8219)));
    const applied = Math.hypot(updates[1].lat - updates[0].lat, updates[1].lng - updates[0].lng) * 111_320;
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

  it("simulate() sets a manual location and marks it simulated", () => {
    const { result } = renderHook(() => useMyLocation());
    act(() => result.current.simulate({ lat: 1, lng: 2 }));
    expect(result.current.location).toEqual({ lat: 1, lng: 2 });
    expect(result.current.simulated).toBe(true);
    expect(result.current.error).toBeNull();
  });
});