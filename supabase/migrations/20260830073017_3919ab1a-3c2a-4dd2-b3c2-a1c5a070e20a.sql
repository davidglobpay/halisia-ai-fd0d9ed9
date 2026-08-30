
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS legacy_parcel_code text,
  ADD COLUMN IF NOT EXISTS legacy_title_deed_no text,
  ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_confidence smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS verification_evidence_ref text,
  ADD COLUMN IF NOT EXISTS verification_updated_at timestamptz;

ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_verification_state_chk;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_verification_state_chk
  CHECK (verification_state IN ('unverified','submitted','in_review','evidence_backed','rejected'));
ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_verification_confidence_chk;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_verification_confidence_chk
  CHECK (verification_confidence BETWEEN 0 AND 100);

ALTER TABLE public.parcels ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.parcel_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  method text,
  evidence_ref text,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.parcel_verification_events TO authenticated;
GRANT ALL ON public.parcel_verification_events TO service_role;
ALTER TABLE public.parcel_verification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read verification history" ON public.parcel_verification_events;
CREATE POLICY "Authenticated users can read verification history"
  ON public.parcel_verification_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Reviewers can record verification events" ON public.parcel_verification_events;
CREATE POLICY "Reviewers can record verification events"
  ON public.parcel_verification_events FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'administrator')
    OR public.has_role(auth.uid(), 'surveyor')
  );

CREATE INDEX IF NOT EXISTS parcel_verification_events_parcel_idx
  ON public.parcel_verification_events (parcel_id, created_at DESC);

UPDATE public.parcels SET
  status = 'pending',
  verification_state = 'unverified',
  verification_confidence = 0,
  verification_method = NULL,
  verification_evidence_ref = NULL,
  verification_updated_at = now(),
  survey_verified_on = NULL;

UPDATE public.parcels SET
  legacy_parcel_code = 'KJD-RUIRU-2451',
  legacy_title_deed_no = 'NAIROBI/BLOCK 118/2451',
  parcel_code = 'KMB-RUIRU-2451',
  title_deed_no = 'KIAMBU/RUIRU/2451'
WHERE parcel_code = 'KJD-RUIRU-2451';

UPDATE public.parcels SET geometry = '{"type":"Polygon","coordinates":[[[36.9527981,-1.4758968],[36.9532019,-1.4758968],[36.9532019,-1.4763032],[36.9527981,-1.4763032],[36.9527981,-1.4758968]]]}'::jsonb WHERE parcel_code = 'KJD-KIT-8891';
UPDATE public.parcels SET geometry = '{"type":"Polygon","coordinates":[[[36.9580272,-1.148226],[36.9583728,-1.148226],[36.9583728,-1.148574],[36.9580272,-1.148574],[36.9580272,-1.148226]]]}'::jsonb WHERE parcel_code = 'KMB-RUIRU-2451';
UPDATE public.parcels SET geometry = '{"type":"Polygon","coordinates":[[[39.7441171,-3.9419163],[39.7444829,-3.9419163],[39.7444829,-3.9422837],[39.7441171,-3.9422837],[39.7441171,-3.9419163]]]}'::jsonb WHERE parcel_code = 'MSA-MTW-1204';

UPDATE public.parcel_beacons b SET lat = v.lat, lng = v.lng
FROM (VALUES
  ('KJD-KIT-8891',1,-1.4758968,36.9527981),
  ('KJD-KIT-8891',2,-1.4758968,36.9532019),
  ('KJD-KIT-8891',3,-1.4763032,36.9532019),
  ('KJD-KIT-8891',4,-1.4763032,36.9527981),
  ('KMB-RUIRU-2451',1,-1.148226,36.9580272),
  ('KMB-RUIRU-2451',2,-1.148226,36.9583728),
  ('KMB-RUIRU-2451',3,-1.148574,36.9583728),
  ('KMB-RUIRU-2451',4,-1.148574,36.9580272),
  ('MSA-MTW-1204',1,-3.9419163,39.7441171),
  ('MSA-MTW-1204',2,-3.9419163,39.7444829),
  ('MSA-MTW-1204',3,-3.9422837,39.7444829),
  ('MSA-MTW-1204',4,-3.9422837,39.7441171)
) AS v(code, ord, lat, lng)
JOIN public.parcels p ON p.parcel_code = v.code
WHERE b.parcel_id = p.id AND b.ordinal = v.ord;

UPDATE public.architectural_prototypes SET gltf_url = '/_massing/ghala-logistics-warehouse.glb', usdz_url = '/_massing/ghala-logistics-warehouse.usdz' WHERE title = 'Ghala Logistics Warehouse';
UPDATE public.architectural_prototypes SET gltf_url = '/_massing/jenga-container-mall.glb', usdz_url = '/_massing/jenga-container-mall.usdz' WHERE title = 'Jenga Container Mall';
UPDATE public.architectural_prototypes SET gltf_url = '/_massing/maridadi-4-bed-villa.glb', usdz_url = '/_massing/maridadi-4-bed-villa.usdz' WHERE title = 'Maridadi 4-Bed Villa';
UPDATE public.architectural_prototypes SET gltf_url = '/_massing/nyumbani-apartment-block.glb', usdz_url = '/_massing/nyumbani-apartment-block.usdz' WHERE title = 'Nyumbani Apartment Block';
UPDATE public.architectural_prototypes SET gltf_url = '/_massing/sokoni-commercial-plaza.glb', usdz_url = '/_massing/sokoni-commercial-plaza.usdz' WHERE title = 'Sokoni Commercial Plaza';
