/** Missing or legacy grid status must not turn substituted terrain into evidence. */
export function geotechAvailability(measured: boolean | null | undefined) {
  const available = measured === true;
  return {
    terrainDerivedAvailable: available,
    exportAvailable: available,
    message: available
      ? "Terrain values are derived from an elevation grid; subsurface interpretations remain estimates."
      : "Elevation grid unavailable. Terrain-derived geology, bedrock, groundwater, foundation and risk interpretations are withheld. The geotechnical PDF export is unavailable.",
  };
}
