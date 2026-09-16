export type GazetteerMatch = {
  address: string;
  lat: number;
  lng: number;
  placeId: null;
  source: "local-gazetteer";
};

const PLACES = [
  { names: ["nairobi cbd", "nairobi"], address: "Nairobi CBD, Nairobi, Kenya", lat: -1.286389, lng: 36.817223 },
  { names: ["kisumu"], address: "Kisumu, Kenya", lat: -0.091702, lng: 34.767956 },
  { names: ["mombasa"], address: "Mombasa, Kenya", lat: -4.043477, lng: 39.668206 },
  { names: ["karen", "karen nairobi"], address: "Karen, Nairobi, Kenya", lat: -1.3197, lng: 36.7073 },
  { names: ["nakuru"], address: "Nakuru, Kenya", lat: -0.303099, lng: 36.080025 },
  { names: ["eldoret"], address: "Eldoret, Kenya", lat: 0.514277, lng: 35.269779 },
] as const;

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/,?\s*kenya\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findKenyaGazetteerPlace(query: string): GazetteerMatch | null {
  const wanted = normalise(query);
  const place = PLACES.find(({ names }) => names.some((name) => normalise(name) === wanted));
  return place
    ? { address: place.address, lat: place.lat, lng: place.lng, placeId: null, source: "local-gazetteer" }
    : null;
}
