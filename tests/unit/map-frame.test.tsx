import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapFrame } from "@/components/halisia/map-frame";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { back: vi.fn() } }),
}));

describe("MapFrame", () => {
  it("preserves the mobile-first map aspect ratio and desktop breakpoint classes", () => {
    render(
      <MapFrame showBack={false} onLocateMe={() => {}}>
        <div data-testid="map-body" />
      </MapFrame>,
    );

    const frame = screen.getByTestId("map-frame");
    expect(frame).toHaveClass("aspect-[3/4]");
    expect(frame).toHaveClass("md:aspect-[16/9]");
    expect(frame).toHaveClass("md:min-h-[420px]");
    expect(screen.getByTestId("map-body")).toBeInTheDocument();
  });

  it("renders the complete mobile toolbar when back and location controls are available", async () => {
    window.history.pushState({}, "", "/previous");
    render(
      <MapFrame onLocateMe={() => {}}>
        <div />
      </MapFrame>,
    );

    await waitFor(() => expect(screen.getByTestId("map-back-button")).toBeVisible());
    expect(screen.getByTestId("map-my-location")).toBeVisible();
    expect(screen.getByRole("button", { name: /go back to previous view/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /center map on my current location/i })).toBeVisible();
  });
});