CREATE TABLE IF NOT EXISTS public.location_intel_slices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_key TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  parcel_id UUID NULL,
  slice TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  reason TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NULL,
  method TEXT NULL,
  version TEXT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT location_intel_slices_unique UNIQUE (location_key, slice)
);

CREATE INDEX IF NOT EXISTS location_intel_slices_lookup
  ON public.location_intel_slices (location_key, slice, expires_at);
CREATE INDEX IF NOT EXISTS location_intel_slices_parcel
  ON public.location_intel_slices (parcel_id);

GRANT ALL ON public.location_intel_slices TO service_role;

ALTER TABLE public.location_intel_slices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages intel snapshots" ON public.location_intel_slices;
CREATE POLICY "Service role manages intel snapshots"
  ON public.location_intel_slices FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);