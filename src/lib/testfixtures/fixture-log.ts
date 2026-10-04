/** PASS / FAIL / UNKNOWN test log for the developer-only LR fixture. */

export type FixtureVerdict = "PASS" | "FAIL" | "UNKNOWN";

export type FixtureCheckId =
  | "lr-exact-match"
  | "no-identifier-geocode-substitution"
  | "physical-coordinate-shown"
  | "satellite-imagery"
  | "glb-available"
  | "desktop-3d-load"
  | "android-scene-viewer-url"
  | "ios-usdz-availability"
  | "webxr-vr-physical-device"
  | "cadastral-polygon"
  | "model-fit";

export type FixtureCheck = {
  id: FixtureCheckId;
  label: string;
  verdict: FixtureVerdict;
  detail: string;
};

export const FIXTURE_CHECK_LABELS: Record<FixtureCheckId, string> = {
  "lr-exact-match": "LR exact match in parcel index",
  "no-identifier-geocode-substitution": "No identifier → locality substitution (D-29)",
  "physical-coordinate-shown": "User-supplied physical coordinate shown",
  "satellite-imagery": "Location imagery centred on coordinate",
  "glb-available": "Fixture GLB available",
  "desktop-3d-load": "Desktop 3D preview loads",
  "android-scene-viewer-url": "Android Scene Viewer URL valid",
  "ios-usdz-availability": "iOS Quick Look USDZ availability",
  "webxr-vr-physical-device": "WebXR / VR handoff (device test)",
  "cadastral-polygon": "Evidence-backed cadastral polygon",
  "model-fit": "Model fit against legal boundary",
};

export function check(id: FixtureCheckId, verdict: FixtureVerdict, detail: string): FixtureCheck {
  return { id, label: FIXTURE_CHECK_LABELS[id], verdict, detail };
}

/** Static verdicts that never depend on runtime state for this fixture. */
export const BASELINE_CHECKS: readonly FixtureCheck[] = Object.freeze([
  check(
    "lr-exact-match",
    "FAIL",
    "No exact parcel row for KONZA SOUTH/KONZA SOUTH BLOCK 5 (KONZA)/14726 — expected for this fixture.",
  ),
  check(
    "no-identifier-geocode-substitution",
    "PASS",
    "Identifier resolution has no geocode or nearest-parcel branch.",
  ),
  check(
    "physical-coordinate-shown",
    "PASS",
    "-1.7568583, 37.1036167 displayed as a user-supplied physical test location only.",
  ),
  check(
    "cadastral-polygon",
    "FAIL",
    "Boundary evidence NONE; no polygon exists and none is generated from the 0.0440 ha figure.",
  ),
  check(
    "model-fit",
    "UNKNOWN",
    "Massing fit against a legal boundary is unavailable without an evidence-backed polygon.",
  ),
  check(
    "ios-usdz-availability",
    "UNKNOWN",
    "No USDZ published for the fixture cohort — Quick Look disabled, not faked.",
  ),
  check(
    "webxr-vr-physical-device",
    "UNKNOWN",
    "PHYSICAL DEVICE TEST REQUIRED — Android ARCore, iPhone/iPad Quick Look, Meta Quest, Apple Vision Pro.",
  ),
]);
