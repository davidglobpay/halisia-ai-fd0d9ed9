import type { LucideIcon } from "lucide-react";
import {
  Brain,
  CloudSun,
  Landmark,
  Layers,
  LucideIcon,
  MapPin,
  Navigation,
  Satellite,
  ShoppingBag,
  Sparkles,
  UploadCloud,
} from "lucide-react";

export type Stage = {
  title: string;
  role: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  tone: "input" | "source" | "engine" | "output";
  /** How much the score can lean on this stage, 0–100. */
  confidence: number;
  freshness: string;
  /** What actually happens in this step. */
  what: string[];
  /** Named datasets / systems used. */
  sources: { label: string; url?: string }[];
  /** Plain-language value of this stage to the reader. */
  youGet: string;
  /** Share of the final intelligence score this stage influences, in %. */
  weight: number;
  /** Where this stage can be uncertain. */
  caveat: string;
};

/**
 * The HALISIA data pipeline: every stage a listing passes through, from the
 * seller's upload to the marketplace card a buyer finally reads.
 */
export const PIPELINE_STAGES: Stage[] = [
  {
    title: "User listing",
    role: "Input",
    detail: "Title, size, price, photos and utilities captured in the guided listing wizard.",
    icon: UploadCloud,
    tone: "input",
    confidence: 55,
    freshness: "At submission",
    what: [
      "The seller completes the guided wizard: title, size, tenure, price and utilities.",
      "Photos and documents are attached and a completeness percentage is calculated.",
      "The AI listing coach flags missing or contradictory information before publishing.",
    ],
    sources: [{ label: "Seller-declared data (HALISIA listing wizard)" }],
    youGet:
      "You control this stage: the more complete and honest your listing, the higher every downstream score can climb.",
    weight: 6,
    caveat:
      "Self-declared by the seller and not independently verified, so it carries the lowest weight in the score.",
  },
  {
    title: "GPS location",
    role: "Input",
    detail: "A map pin or device location fixes the parcel to real coordinates.",
    icon: Navigation,
    tone: "input",
    confidence: 80,
    freshness: "At submission",
    what: [
      "A map pin, device geolocation or typed coordinates anchor the parcel.",
      "Coordinates are reverse-geocoded to a ward, sub-county and county.",
      "Every downstream dataset is queried against this exact point.",
    ],
    sources: [
      { label: "Browser Geolocation API" },
      { label: "Leaflet / OpenStreetMap pin picker", url: "https://www.openstreetmap.org/" },
    ],
    youGet:
      "A precise pin means the amenities, climate and risk figures you read actually describe your parcel — not the next ridge.",
    weight: 9,
    caveat:
      "Pin accuracy depends on how precisely the seller placed it; a coarse pin shifts nearby-amenity results.",
  },
  {
    title: "OpenStreetMap",
    role: "Open data",
    detail: "Roads, amenities, schools, health facilities and transport within reach.",
    icon: MapPin,
    href: "https://www.openstreetmap.org/copyright",
    tone: "source",
    confidence: 78,
    freshness: "Community-updated, continuous",
    what: [
      "Overpass queries pull roads, schools, clinics, markets and transport nodes around the pin.",
      "Each amenity is distance-ranked and converted into access and livability signals.",
    ],
    sources: [
      { label: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
      { label: "Overpass API", url: "https://overpass-api.de/" },
    ],
    youGet:
      "This is what tells you how far the nearest school, clinic, matatu stage or market really is.",
    weight: 13,
    caveat:
      "Rural coverage is thinner than urban coverage, so sparse areas can under-report amenities.",
  },
  {
    title: "Geoapify",
    role: "Open data",
    detail: "Geocoding, reverse geocoding and place enrichment around the pin.",
    icon: Layers,
    href: "https://www.geoapify.com/",
    tone: "source",
    confidence: 74,
    freshness: "Rolling refresh",
    what: [
      "Forward and reverse geocoding resolve the pin into a structured address.",
      "Place enrichment adds categorised POIs and isoline reachability around the parcel.",
    ],
    sources: [{ label: "Geoapify Places & Geocoding", url: "https://www.geoapify.com/" }],
    youGet:
      "It turns your pin into a proper address and neighbourhood picture you can share with a bank or buyer.",
    weight: 7,
    caveat:
      "Place categories are generalised globally and may not match Kenyan local naming exactly.",
  },
  {
    title: "Open-Meteo",
    role: "Open data",
    detail: "Climate normals, rainfall and temperature history for the location.",
    icon: CloudSun,
    href: "https://open-meteo.com/",
    tone: "source",
    confidence: 85,
    freshness: "Daily",
    what: [
      "Historical reanalysis gives rainfall, temperature and seasonality for the coordinates.",
      "Climate normals feed flood, drought and construction-window risk scoring.",
    ],
    sources: [{ label: "Open-Meteo archive & forecast API", url: "https://open-meteo.com/" }],
    youGet:
      "You get an honest read on rainfall, flooding and the best months to build before you commit money.",
    weight: 10,
    caveat:
      "Reanalysis grids are coarse; micro-climates in valleys or highlands may differ locally.",
  },
  {
    title: "Satellite data",
    role: "Earth observation",
    detail: "Elevation, slope, terrain modelling and soil profiles from global rasters.",
    icon: Satellite,
    href: "https://soilgrids.org/",
    tone: "source",
    confidence: 72,
    freshness: "Per raster release",
    what: [
      "Digital elevation models produce slope, aspect and drainage direction.",
      "SoilGrids profiles estimate texture, pH and bearing behaviour by depth.",
      "Results drive the geotechnical module and foundation guidance.",
    ],
    sources: [
      { label: "ISRIC SoilGrids v2.0", url: "https://soilgrids.org/" },
      { label: "Copernicus / ASTER elevation", url: "https://www.earthdata.nasa.gov/" },
    ],
    youGet:
      "You see slope, drainage and likely soil behaviour early — the things that quietly blow up foundation budgets.",
    weight: 14,
    caveat:
      "Global rasters are modelled at 30–250 m resolution — indicative only, never a substitute for a site survey.",
  },
  {
    title: "Government data",
    role: "Official records",
    detail: "County boundaries, census indicators and public administrative datasets.",
    icon: Landmark,
    href: "https://www.knbs.or.ke/",
    tone: "source",
    confidence: 68,
    freshness: "Census & gazette cycles",
    what: [
      "County and ward boundaries locate the parcel inside its administrative unit.",
      "Census and public indicators add population, services and development context.",
    ],
    sources: [
      { label: "Kenya National Bureau of Statistics", url: "https://www.knbs.or.ke/" },
      { label: "IEBC boundary datasets", url: "https://www.iebc.or.ke/" },
    ],
    youGet:
      "It places your parcel in its official county and ward context, which matters for approvals and services.",
    weight: 8,
    caveat:
      "Official releases lag reality between census cycles, so fast-growing areas can look understated.",
  },
  {
    title: "AI analysis",
    role: "Reasoning",
    detail: "Signals are cross-read, weighted and turned into plain-language findings.",
    icon: Brain,
    tone: "engine",
    confidence: 70,
    freshness: "Per request",
    what: [
      "All retrieved signals are cross-read for agreement, conflict and gaps.",
      "The model writes plain-language findings and flags what it could not verify.",
      "Every claim is bound to the signal it came from for the evidence panel.",
    ],
    sources: [{ label: "HALISIA reasoning layer over the retrieved signals above" }],
    youGet:
      "You get a plain-language explanation, not a black-box number, including what the system could not confirm.",
    weight: 10,
    caveat:
      "Reasoning inherits the weakest input — thin data in means a hedged, lower-confidence narrative out.",
  },
  {
    title: "HALISIA intelligence score",
    role: "Synthesis",
    detail: "Ten weighted scorers produce one defensible score with visible evidence.",
    icon: Sparkles,
    tone: "engine",
    confidence: 76,
    freshness: "Per request",
    what: [
      "Ten modular scorers each grade one dimension: access, risk, utilities, growth and more.",
      "Weights shift with your persona — buyer, investor, developer or renter.",
      "The final score ships with a confidence percentage and its full evidence trail.",
    ],
    sources: [{ label: "HALISIA Land Intelligence Engine (10 weighted scorers)" }],
    youGet:
      "One comparable score you can defend to a spouse, a partner or a lender — with the workings attached.",
    weight: 15,
    caveat: "A score is decision support, not a valuation, survey or legal opinion.",
  },
  {
    title: "Marketplace listing",
    role: "Output",
    detail: "Buyers see the listing alongside its score, evidence and citations.",
    icon: ShoppingBag,
    tone: "output",
    confidence: 90,
    freshness: "Live",
    what: [
      "The published listing renders the score, evidence panel and source citations together.",
      "Buyers can open any citation, download the PDF dossier or compare locations.",
    ],
    sources: [{ label: "HALISIA marketplace & PDF dossier export" }],
    youGet:
      "You can act: open a citation, download the dossier, compare two parcels or contact the seller with evidence in hand.",
    weight: 8,
    caveat:
      "Displays exactly what the pipeline produced — always read the confidence chips alongside it.",
  },
];
