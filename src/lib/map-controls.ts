/**
 * Pure helpers behind the shared floating map controls, kept free of React so
 * they can be unit tested.
 */

export type LayerSelectionKind = "single" | "multi";

/**
 * Next selection after the user taps an option. A single-choice group always
 * keeps exactly one option; a multi-choice group toggles the tapped option and
 * keeps the original order of the options.
 */
export function nextLayerSelection(
  kind: LayerSelectionKind,
  optionIds: readonly string[],
  selected: readonly string[],
  tapped: string,
): string[] {
  if (!optionIds.includes(tapped)) return [...selected];
  if (kind === "single") return [tapped];
  const on = new Set(selected);
  if (on.has(tapped)) on.delete(tapped);
  else on.add(tapped);
  return optionIds.filter((id) => on.has(id));
}

/** Count shown on the Layers button: optional overlays that are switched on. */
export function activeOverlayCount(
  groups: ReadonlyArray<{ kind: LayerSelectionKind; selected: readonly string[] }>,
): number {
  return groups.filter((g) => g.kind === "multi").reduce((n, g) => n + g.selected.length, 0);
}

/** Browser element-fullscreen support (iPhone Safari has none). */
export function fullscreenSupported(doc: Document | undefined): boolean {
  return !!doc && typeof doc.documentElement?.requestFullscreen === "function";
}
