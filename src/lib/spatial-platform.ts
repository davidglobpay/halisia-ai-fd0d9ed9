/**
 * Platform detection + truthful fallback copy for the Spatial AR studio.
 *
 * Reality check baked into the copy:
 * - iOS/iPadOS Safari does NOT expose WebXR immersive-AR — Apple's native AR
 *   path is AR Quick Look with a USDZ model.
 * - Android Chrome can run WebXR immersive-AR (via ARCore) or fall back to
 *   Google's Scene Viewer with a glTF model.
 * - Desktop browsers keep the interactive 3D studio.
 *
 * Pure functions only — safe for SSR and unit tests.
 */

export type ArPlatform = "ios" | "android" | "desktop";

/** Detect the AR-relevant platform from a user agent string. */
export function arPlatformFromUA(userAgent: string, maxTouchPoints = 0): ArPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipod|ipad/.test(ua)) return "ios";
  // iPadOS 13+ reports as Macintosh; multi-touch gives it away.
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Truthful, platform-aware message for the AR fallback panel. Never promises
 * a native viewer whose model asset does not exist, and never implies iOS has
 * Android-equivalent WebXR.
 */
export function arFallbackMessage(input: {
  platform: ArPlatform;
  prototypeSelected: boolean;
  hasUsdz: boolean;
  hasGltf: boolean;
}): string {
  const { platform, prototypeSelected, hasUsdz, hasGltf } = input;
  if (!prototypeSelected) {
    return "Select a massing prototype to unlock the native AR viewers — the interactive 3D studio above works on any device.";
  }
  if (!hasUsdz && !hasGltf) {
    return "This prototype has no published AR model (USDZ/glTF) yet — the interactive 3D studio above shows the same survey, massing and sun-path data.";
  }
  if (platform === "ios") {
    return hasUsdz
      ? "Safari on iOS/iPadOS does not support WebXR immersive-AR. Open the model in AR Quick Look below — the 3D studio stays fully interactive."
      : "Safari on iOS/iPadOS does not support WebXR immersive-AR, and this prototype's model is published for Android (glTF) only. The interactive 3D studio above remains available.";
  }
  if (platform === "android") {
    return hasGltf
      ? "WebXR AR needs Chrome with Google ARCore on this device. You can also open the model in Scene Viewer below — the 3D studio stays fully interactive."
      : "This prototype's model is published for Apple Quick Look (USDZ) only. The interactive 3D studio above remains available.";
  }
  return "This browser does not expose WebXR immersive-AR. Use a native viewer below or keep exploring in the interactive 3D studio.";
}
