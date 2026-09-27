export type StudioTopology = "level" | "gentle-slope" | "terraced";
export type StudioEnvironment = "day" | "neutral" | "night";

export type StudioConcept = {
  id: string;
  name: string;
  use: string;
  context: string;
  modelUrl: string;
  authoredFootprintSqm: number;
  authoredHeightM: number;
  defaultTopology: StudioTopology;
  landscape: string;
};

export const STUDIO_CONCEPTS: readonly StudioConcept[] = Object.freeze([
  {
    id: "residential-villa",
    name: "Maridadi courtyard villa",
    use: "Residential",
    context: "Low-density home concept with shaded arrival court and kitchen garden.",
    modelUrl: "/_massing/maridadi-4-bed-villa.glb",
    authoredFootprintSqm: 210,
    authoredHeightM: 7.5,
    defaultTopology: "gentle-slope",
    landscape: "Native shade planting, private court, two-car bay",
  },
  {
    id: "affordable-community",
    name: "Nyumbani shared-living court",
    use: "Affordable housing / shared living",
    context: "Compact homes around a shared green, play space and pedestrian court.",
    modelUrl: "/_massing/nyumbani-apartment-block.glb",
    authoredFootprintSqm: 480,
    authoredHeightM: 21,
    defaultTopology: "level",
    landscape: "Shared court, play lawn, pedestrian paths, parking edge",
  },
  {
    id: "mixed-use-centre",
    name: "Jenga neighbourhood centre",
    use: "Mixed use",
    context: "Neighbourhood shops and flexible upper-level community or work space.",
    modelUrl: "/_massing/jenga-container-mall.glb",
    authoredFootprintSqm: 420,
    authoredHeightM: 6.5,
    defaultTopology: "terraced",
    landscape: "Market court, service bay, shaded walk, rain-garden cue",
  },
  {
    id: "commercial-plaza",
    name: "Sokoni commercial plaza",
    use: "Commercial / mall",
    context: "Retail and office concept with a shaded public forecourt and service access.",
    modelUrl: "/_massing/sokoni-commercial-plaza.glb",
    authoredFootprintSqm: 640,
    authoredHeightM: 18,
    defaultTopology: "level",
    landscape: "Public forecourt, parking court, service lane, shade planting",
  },
  {
    id: "employment-campus",
    name: "Ghala employment campus",
    use: "Special purpose / mini-city employment",
    context: "Logistics and light-industry anchor with expandable work yards and staff green.",
    modelUrl: "/_massing/ghala-logistics-warehouse.glb",
    authoredFootprintSqm: 1200,
    authoredHeightM: 9,
    defaultTopology: "gentle-slope",
    landscape: "Loading yard, staff green, perimeter planting, drainage swale cue",
  },
]);

export const STUDIO_DISCLAIMER =
  "Concept visualization on user-entered simulation dimensions. Not a surveyed parcel, planning approval, architectural drawing, flood assessment or construction specification.";

export function validSimulationDimension(value: number): boolean {
  return Number.isFinite(value) && value >= 12 && value <= 500;
}