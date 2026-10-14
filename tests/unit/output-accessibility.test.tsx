import { visibleOutputText } from "@/components/halisia/output-text";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListenButton } from "@/components/halisia/listen-button";
import { OutputTools, OutputVisual } from "@/components/halisia/output-tools";
import { HoloTile } from "@/components/halisia/ds/holo-tile";
import { referencesForOutput } from "@/lib/output-visuals";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function voice() {
  const spoken: { text: string; onend?: () => void }[] = [];
  class Utterance {
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  }
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn((u) => spoken.push(u)),
    getVoices: () => [],
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { synth, spoken };
}
describe("per-output narration", () => {
  it("reads updated values on click and excludes hidden output and controls", () => {
    const { spoken } = voice();
    const view = render(
      <div data-output-card>
        <h3>Soil</h3>
        <p>Clay 20 percent. Source SoilGrids; preliminary.</p>
        <div hidden>SECRET HIDDEN</div>
        <button>Export</button>
        <OutputTools label="soil" />
      </div>,
    );
    view.rerender(
      <div data-output-card>
        <h3>Soil</h3>
        <p>Clay 35 percent. Source SoilGrids; preliminary.</p>
        <div hidden>SECRET HIDDEN</div>
        <button>Export</button>
        <OutputTools label="soil" />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Listen to soil: read aloud" }));
    expect(spoken[0].text).toContain("35 percent");
    expect(spoken[0].text).toContain("preliminary");
    expect(spoken[0].text).not.toMatch(/SECRET|Export|20 percent/);
  });
  it("stops the previous tile when another starts", () => {
    const { synth } = voice();
    render(
      <>
        <ListenButton label="first" text="First" />
        <ListenButton label="second" text="Second" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "first: read aloud" }));
    fireEvent.click(screen.getByRole("button", { name: "second: read aloud" }));
    expect(screen.getByRole("button", { name: "first: read aloud" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Stop reading second" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it("cancels speech on navigation/unmount", () => {
    const { synth } = voice();
    const v = render(<ListenButton text="Test" />);
    fireEvent.click(screen.getByRole("button"));
    v.unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it("shows an explicit unavailable state", () => {
    const saved = window.speechSynthesis;
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    render(<ListenButton text="test" />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("unavailable");
    if (saved)
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: saved,
      });
  });
  it("chunks long readings without losing their final words", () => {
    const { spoken } = voice();
    const text = "Measured soil values. ".repeat(40) + "END OF OUTPUT";
    render(<ListenButton text={text} />);
    fireEvent.click(screen.getByRole("button"));
    for (let i = 0; i < spoken.length; i++) spoken[i].onend?.();
    expect(spoken.length).toBeGreaterThan(1);
    expect(spoken.map((u) => u.text).join("")).toBe(text);
  });
  it("a cancelled reader cannot restart from an old onend callback", () => {
    const { spoken } = voice();
    render(
      <>
        <ListenButton label="a" text={"old reading ".repeat(40)} />
        <ListenButton label="b" text="new reading" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "a: read aloud" }));
    const old = spoken[0];
    fireEvent.click(screen.getByRole("button", { name: "b: read aloud" }));
    old.onend?.();
    expect(spoken.length).toBe(2);
  });
  it("nested details have their own reader", () => {
    voice();
    render(
      <HoloTile
        title="Ground"
        defaultOpen
        details={[{ key: "soil", label: "Soil", value: "Clay" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Listen to Soil: read aloud" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Listen to Ground: read aloud" })).toBeEnabled();
  });
  it("reads data inside interactive place headers", () => {
    const el = document.createElement("div");
    el.innerHTML = "<button data-output-content>School: 2 km</button><button>Navigate</button>";
    document.body.append(el);
    expect(visibleOutputText(el)).toBe("School: 2 km");
    el.remove();
  });
});
describe("visual evidence integrity", () => {
  it.each([
    "Maize",
    "Tea",
    "Coffee",
    "Beans",
    "Potatoes",
    "Quartz",
    "Limestone",
    "Strip foundation",
    "Raft foundation",
    "Soil profile",
  ])("matches a researched reference for %s", (text) => {
    expect(referencesForOutput(text).length).toBeGreaterThan(0);
  });
  it("never substitutes a generic venue for an exact school", () => {
    expect(referencesForOutput("Konza Primary School")).toEqual([]);
  });
  it("does not infer unknown crop types", () => {
    expect(referencesForOutput("Recommended crops not available")).toEqual([]);
  });
  it("suppresses images for missing facts", () => {
    const v = render(<OutputVisual subject="Soil" value={null} />);
    expect(v.container.querySelector("img")).toBeNull();
  });
  it("displays creator, location, source, licence and illustration status", () => {
    render(<OutputVisual subject="Maize" value="Example" />);
    expect(screen.getByText(/Reference illustration/)).toBeInTheDocument();
    expect(screen.getByText(/Kemboh/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toBeInTheDocument();
    expect(screen.getByAltText(/not this parcel/)).toBeInTheDocument();
  });
  it("keeps captions and source accessible after an image fails", () => {
    render(<OutputVisual subject="Maize" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Kemboh/)).toBeInTheDocument();
  });
});
