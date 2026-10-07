import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NavGuide } from "@/components/halisia/nav-guide";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: route }),
}));

describe("guided-tour keyboard isolation", () => {
  beforeEach(() => {
    route.pathname = "/";
    localStorage.setItem("halisia:navguide:v1:seen", "seen");
  });
  afterEach(cleanup);

  it("opens from the page shortcut and closes on Escape", () => {
    render(<NavGuide />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not interrupt typing a question into a form or editable region", () => {
    render(
      <>
        <NavGuide />
        <input aria-label="Question" />
        <textarea aria-label="Notes" />
        <div contentEditable suppressContentEditableWarning>
          <span>Editable text</span>
        </div>
      </>,
    );
    for (const target of [
      screen.getByLabelText("Question"),
      screen.getByLabelText("Notes"),
      screen.getByText("Editable text"),
    ]) {
      fireEvent.keyDown(target, { key: "?" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
  });

  it("does not open over authentication or password-reset screens", () => {
    for (const pathname of ["/auth", "/reset-password"]) {
      route.pathname = pathname;
      const view = render(<NavGuide />);
      fireEvent.keyDown(window, { key: "?" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
