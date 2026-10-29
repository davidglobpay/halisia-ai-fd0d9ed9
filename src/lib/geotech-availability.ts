/** Missing or legacy grid status must not turn substituted terrain into evidence. */
export function geotechAvailability(
  measured: boolean | null | undefined,
  /**
   * True when the elevation grid loaded but failed its quality checks, so
   * terrain was withheld rather than missing. Defaults to "did not load".
   */
  gridRejected = false,
) {
  const available = measured === true;
  return {
    terrainDerivedAvailable: available,
    exportAvailable: available,
    message: available
      ? "Terrain values are derived from an elevation grid; subsurface conditions and foundation suitability are not assessed."
      : gridRejected
        ? "Elevation grid failed quality checks: isolated samples disagree with their neighbours. Terrain-derived geology, bedrock, groundwater, foundation and risk interpretations are withheld. The geotechnical PDF export is unavailable."
        : "Elevation grid unavailable. Terrain-derived geology, bedrock, groundwater, foundation and risk interpretations are withheld. The geotechnical PDF export is unavailable.",
  };
}
