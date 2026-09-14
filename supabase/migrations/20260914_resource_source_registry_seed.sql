-- Register data systems already used by HALISIA. This does not assert that
-- every source has produced a Resource Intelligence observation yet.

INSERT INTO public.resource_sources(
  authority,
  source_system,
  source_url,
  source_class,
  licence,
  approved_method
)
VALUES
  (
    'Google Maps Platform',
    'google_elevation',
    'https://developers.google.com/maps/documentation/elevation',
    'third_party',
    NULL,
    'gateway_elevation_lookup'
  ),
  (
    'Google Maps Platform',
    'google_air_quality',
    'https://developers.google.com/maps/documentation/air-quality',
    'third_party',
    NULL,
    'current_conditions_lookup'
  ),
  (
    'Google Maps Platform',
    'google_places_routes',
    'https://developers.google.com/maps/documentation/places/web-service',
    'third_party',
    NULL,
    'nearby_search_plus_route_matrix'
  ),
  (
    'OpenStreetMap contributors',
    'openstreetmap',
    'https://www.openstreetmap.org/copyright',
    'third_party',
    'ODbL',
    'overpass_or_map_layer'
  ),
  (
    'Open-Meteo',
    'openmeteo',
    'https://open-meteo.com',
    'third_party',
    NULL,
    'climate_weather_lookup'
  ),
  (
    'ISRIC',
    'soilgrids_v2',
    'https://soilgrids.org',
    'third_party',
    NULL,
    'soilgrids_context'
  )
ON CONFLICT (authority, source_system) DO NOTHING;
