export function foundationAssumption(
  topology: "level" | "gentle-slope" | "terraced" = "level",
): string {
  if (topology === "terraced")
    return "Stepped strip / pad footings on cut terraces with retaining walls (assumption)";
  if (topology === "gentle-slope")
    return "Strip footings stepped with the fall; cut-and-fill platform (assumption)";
  return "Strip or pad footings on level platform (assumption)";
}
