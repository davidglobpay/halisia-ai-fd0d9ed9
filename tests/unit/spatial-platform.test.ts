import { describe, expect, it } from "vitest";
import { arFallbackMessage, arPlatformFromUA } from "@/lib/spatial-platform";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPADOS_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("arPlatformFromUA", () => {
  it("detects iPhone Safari as ios", () => {
    expect(arPlatformFromUA(IPHONE, 5)).toBe("ios");
  });

  it("detects iPadOS masquerading as macOS via touch points", () => {
    expect(arPlatformFromUA(IPADOS_DESKTOP_UA, 5)).toBe("ios");
  });

  it("does not mistake real macOS Safari for iPadOS", () => {
    expect(arPlatformFromUA(MAC_SAFARI, 0)).toBe("desktop");
  });

  it("detects Android Chrome", () => {
    expect(arPlatformFromUA(ANDROID, 5)).toBe("android");
  });

  it("defaults desktop browsers to desktop", () => {
    expect(arPlatformFromUA(WINDOWS_CHROME, 0)).toBe("desktop");
  });
});

describe("arFallbackMessage", () => {
  it("asks for a prototype when none is selected", () => {
    expect(
      arFallbackMessage({
        platform: "android",
        prototypeSelected: false,
        hasUsdz: false,
        hasGltf: false,
      }),
    ).toMatch(/Select a massing prototype/i);
  });

  it("never promises a native viewer when no model asset is published", () => {
    const msg = arFallbackMessage({
      platform: "ios",
      prototypeSelected: true,
      hasUsdz: false,
      hasGltf: false,
    });
    expect(msg).toMatch(/no published AR model/i);
    expect(msg).not.toMatch(/Quick Look below/);
  });

  it("tells iOS users the truth: no WebXR immersive-AR, Quick Look when USDZ exists", () => {
    const msg = arFallbackMessage({
      platform: "ios",
      prototypeSelected: true,
      hasUsdz: true,
      hasGltf: true,
    });
    expect(msg).toMatch(/does not support WebXR immersive-AR/i);
    expect(msg).toMatch(/Quick Look/i);
  });

  it("does not offer Android glTF to iOS users as a native path", () => {
    const msg = arFallbackMessage({
      platform: "ios",
      prototypeSelected: true,
      hasUsdz: false,
      hasGltf: true,
    });
    expect(msg).toMatch(/Android \(glTF\) only/i);
    expect(msg).not.toMatch(/Scene Viewer below/);
  });

  it("points Android users at ARCore/Scene Viewer when glTF exists", () => {
    const msg = arFallbackMessage({
      platform: "android",
      prototypeSelected: true,
      hasUsdz: true,
      hasGltf: true,
    });
    expect(msg).toMatch(/ARCore/i);
    expect(msg).toMatch(/Scene Viewer below/i);
  });

  it("keeps desktop copy generic", () => {
    expect(
      arFallbackMessage({
        platform: "desktop",
        prototypeSelected: true,
        hasUsdz: true,
        hasGltf: false,
      }),
    ).toMatch(/does not expose WebXR immersive-AR/i);
  });
});
