/** Curated reference media. Never parcel evidence or proof of local occurrence. */
export type OutputReference = {
  title: string;
  file: string;
  src: string;
  author: string;
  license: string;
  location: string;
  match: RegExp;
};
export const OUTPUT_REFERENCES: OutputReference[] = [
  {
    title: "Bored pile foundation construction sequence",
    file: "Foundation_pile_scheme.svg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Foundation_pile_scheme.svg/960px-Foundation_pile_scheme.svg.png",
    author: "5gon12eder",
    license: "CC BY-SA 4.0",
    location: "Engineering reference diagram",
    match: /\bpiles?(?: foundation)?\b/i,
  },
  {
    title: "Soil horizons — reference profile",
    file: "Soil_profile_0-125cm.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Soil_profile_0-125cm.jpg",
    author: "Mclund",
    license: "CC BY 4.0",
    location: "United States",
    match: /\bsoil(?:s| profile| horizons| layers| composition)?\b/i,
  },
  {
    title: "Strip foundation with stonework",
    file: "Strip_foundation_with_stones.jpg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Strip_foundation_with_stones.jpg/960px-Strip_foundation_with_stones.jpg",
    author: "EzekielFokam",
    license: "CC BY-SA 4.0",
    location: "Cameroon",
    match: /\bstrip(?: foundation| footing)?\b/i,
  },
  {
    title: "Quartz crystal specimen",
    file: "USDA_Mineral_Quartz_Crystal_93c3951.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/a/ab/USDA_Mineral_Quartz_Crystal_93c3951.jpg",
    author: "Ken Hammond / USDA",
    license: "Public domain",
    location: "Specimen photograph",
    match: /\bquartz\b/i,
  },
  {
    title: "Maize plantation in Kitale",
    file: "Maize_plantation_in_Kitale.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Maize_plantation_in_Kitale.jpg",
    author: "Kemboh",
    license: "CC BY-SA 4.0",
    location: "Kitale, Kenya",
    match: /\bmaize\b/i,
  },
  {
    title: "Tea plantation in Murang’a",
    file: "Tea_Plantation_in_Murang'a_County.jpg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Tea_Plantation_in_Murang%27a_County.jpg/500px-Tea_Plantation_in_Murang%27a_County.jpg",
    author: "Samuel Kiongo",
    license: "CC BY-SA 4.0",
    location: "Murang’a County, Kenya",
    match: /\btea\b/i,
  },
  {
    title: "Shallow foundation types — labelled comparison",
    file: "Types_of_Shallow_Foundations.svg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Types_of_Shallow_Foundations.svg/960px-Types_of_Shallow_Foundations.svg.png",
    author: "Jethrude Hipolito",
    license: "CC BY-SA 4.0",
    location: "Engineering reference diagram",
    match: /\b(?:raft|pad|isolated|combined)(?: foundation| footing)?\b/i,
  },
  {
    title: "Potato farm in Narok",
    file: "Potato_farm_in_Kenya.jpg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Potato_farm_in_Kenya.jpg/500px-Potato_farm_in_Kenya.jpg",
    author: "Cmwaura",
    license: "CC BY-SA 4.0",
    location: "Narok County, Kenya",
    match: /\bpotato(?:es)?\b/i,
  },
  {
    title: "Bean plantation in Kenya",
    file: "Bean_plantation_in_kenya.jpg",
    src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Bean_plantation_in_kenya.jpg",
    author: "Mdozy",
    license: "CC BY-SA 4.0",
    location: "Kenya",
    match: /\bbeans?\b/i,
  },
  {
    title: "Coffee berries at Fairview Estate",
    file: "Coffee_berries_on_plants_at_Fairview_Estate,_Kiambu,_KE.jpg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Coffee_berries_on_plants_at_Fairview_Estate%2C_Kiambu%2C_KE.jpg/330px-Coffee_berries_on_plants_at_Fairview_Estate%2C_Kiambu%2C_KE.jpg",
    author: "Daniel Case",
    license: "CC BY-SA 4.0",
    location: "Kiambu, Kenya",
    match: /\bcoffee\b/i,
  },
  {
    title: "Limestone core sample",
    file: "Limestone_core_sample.jpg",
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Limestone_core_sample.jpg/500px-Limestone_core_sample.jpg",
    author: "Max.kit",
    license: "CC BY-SA 4.0",
    location: "Democratic Republic of the Congo",
    match: /\blimestone\b/i,
  },
];
export function referencesForOutput(text: string) {
  // Empty/missing values must not acquire a picture that implies a finding.
  if (!text.trim() || /^(?:not available|unknown|no data|—)$/i.test(text.trim())) return [];
  return OUTPUT_REFERENCES.filter((r) => r.match.test(text)).slice(0, 3);
}
export function referencePage(r: OutputReference) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(r.file)}`;
}
export function referenceLicense(r: OutputReference) {
  return r.license === "Public domain"
    ? "https://creativecommons.org/publicdomain/mark/1.0/"
    : `https://creativecommons.org/licenses/${r.license === "CC BY 4.0" ? "by" : "by-sa"}/4.0/`;
}
