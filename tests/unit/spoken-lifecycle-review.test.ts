// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SpokenText } from "../../src/components/halisia/spoken-text";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
    },
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      rate = 1;
      constructor(public text: string) {}
    },
  );
});
const mount = () =>
  render(
    createElement(SpokenText, {
      text: "One two three four five six seven eight nine ten.",
    }),
  );
it("stopping before fallback delay does not restart highlighting", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
  act(() => {
    vi.advanceTimersByTime(1600);
  });
  expect(document.querySelector('[data-spoken="now"]')).toBeNull();
});
it("pauses highlighting and resumes without counting paused time", () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  act(() => {
    vi.advanceTimersByTime(1500);
  });
  fireEvent.click(screen.getByRole("button", { name: "Pause reading" }));
  const before = document.querySelector('[data-spoken="now"]')?.textContent;
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(document.querySelector('[data-spoken="now"]')?.textContent).toBe(before);
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  act(() => {
    vi.advanceTimersByTime(700);
  });
  expect(document.querySelector('[data-spoken="now"]')?.textContent).not.toBe(before);
});
it("clears the delayed fallback on unmount", () => {
  const view = mount();
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  view.unmount();
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(vi.getTimerCount()).toBe(0);
});

it("resets controls and cancels fallback when the passage changes", () => {
  const view = mount();
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  view.rerender(createElement(SpokenText, { text: "A different passage." }));
  expect(screen.queryByRole("button", { name: "Stop reading" })).toBeNull();
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(document.querySelector('[data-spoken="now"]')).toBeNull();
});
