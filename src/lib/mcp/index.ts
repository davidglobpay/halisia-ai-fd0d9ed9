import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchListings from "./tools/search-listings";
import pulseNews from "./tools/pulse-news";
import savedItems from "./tools/saved-items";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "place-intelligence-hub",
  title: "Place Intelligence Hub",
  version: "0.1.0",
  instructions:
    "HALISIA Kenya land intelligence. Use search_listings for marketplace land, get_pulse_news for land news, list_saved_items for the user's saved places. Listings are source-listed only; never describe them as title- or survey-verified.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchListings, pulseNews, savedItems],
});
