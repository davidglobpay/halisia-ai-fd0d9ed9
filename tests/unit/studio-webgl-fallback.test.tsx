import { render, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { STUDIO_CONCEPTS } from "@/components/halisia/design-studio/catalog";
import StudioViewerInternal from "@/components/halisia/design-studio/studio-viewer.internal";
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        throw new Error("WebGL unavailable");
      }
    },
  };
});
afterEach(cleanup);
it("keeps renderer failure local and reports an actionable unavailable state", () => {
  const onState = vi.fn();
  const onApi = vi.fn();
  expect(() =>
    render(
      <StudioViewerInternal
        concept={STUDIO_CONCEPTS[0]}
        widthM={36}
        depthM={48}
        topology="gentle-slope"
        environment="day"
        rotationDeg={0}
        scalePct={100}
        showParking
        showLandscape
        fitToken={0}
        generated={null}
        onState={onState}
        onApi={onApi}
      />,
    ),
  ).not.toThrow();
  expect(onApi).toHaveBeenCalledWith(null);
  expect(onState).toHaveBeenCalledWith({
    loading: false,
    error: expect.stringContaining("3D rendering is unavailable"),
  });
});
