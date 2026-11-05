import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListenButton } from "@/components/halisia/listen-button";

type FakeUtterance = { text: string; lang: string; onend?: () => void; onerror?: () => void };

function installSpeech() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [{ lang: "en-KE", name: "Kenya" }]),
  };
  class Utterance {
    text: string;
    lang = "";
    voice: unknown = null;
    onend?: () => void;
    onerror?: () => void;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: synth });
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    configurable: true,
    value: Utterance,
  });
  return { synth, spoken };
}

function removeSpeech() {
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
  delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
}

afterEach(() => {
  cleanup();
  removeSpeech();
});

describe("ListenButton without browser speech", () => {
  beforeEach(removeSpeech);

  it("is disabled and says why", () => {
    render(<ListenButton text="Soil is clay loam." label="Soil" />);
    expect(screen.getByRole("button", { name: "Soil: read aloud" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Voice reading is unavailable in this browser.",
    );
  });
});

describe("ListenButton with browser speech", () => {
  it("reads the text in Kenyan English and stops on the second tap", () => {
    const { synth, spoken } = installSpeech();
    render(<ListenButton text="Soil is clay loam." label="Soil" />);

    fireEvent.click(screen.getByRole("button", { name: "Soil: read aloud" }));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text.trim()).toBe("Soil is clay loam.");
    expect(spoken[0].lang).toBe("en-KE");
    const stop = screen.getByRole("button", { name: "Stop reading Soil" });
    expect(stop).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(stop);
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Soil: read aloud" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("splits long text into short passages so phones do not cut it off", () => {
    const { spoken } = installSpeech();
    const long = Array.from({ length: 60 }, (_, i) => `Sentence ${i}.`).join(" ");
    render(<ListenButton text={long} />);
    fireEvent.click(screen.getByRole("button", { name: "Listen: read aloud" }));
    // Passages are queued one after another as each finishes.
    while (spoken.at(-1)?.onend) {
      const last = spoken.at(-1)!;
      const before = spoken.length;
      last.onend!();
      if (spoken.length === before) break;
    }
    expect(spoken.length).toBeGreaterThan(1);
    expect(spoken.every((u) => u.text.length <= 221)).toBe(true);
    expect(
      spoken
        .map((u) => u.text)
        .join("")
        .replace(/\s+/g, " "),
    ).toContain("Sentence 59.");
  });

  it("explains when there is nothing to read", () => {
    installSpeech();
    render(<ListenButton text={() => "   "} />);
    fireEvent.click(screen.getByRole("button", { name: "Listen: read aloud" }));
    expect(screen.getByRole("status")).toHaveTextContent("No output to read yet.");
  });

  it("shows a message when the voice fails", () => {
    const { spoken } = installSpeech();
    render(<ListenButton text="Hello." />);
    fireEvent.click(screen.getByRole("button", { name: "Listen: read aloud" }));
    spoken[0].onerror!();
    expect(screen.getByRole("status")).toHaveTextContent("Voice unavailable");
  });
});
