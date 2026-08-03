ALTER TABLE public.rental_details
  ADD COLUMN IF NOT EXISTS availability_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS viewing_windows jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.renter_preferences
  ADD COLUMN IF NOT EXISTS commute_origin_label text,
  ADD COLUMN IF NOT EXISTS commute_origin_lat double precision,
  ADD COLUMN IF NOT EXISTS commute_origin_lng double precision,
  ADD COLUMN IF NOT EXISTS max_commute_minutes integer;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS development_concept jsonb,
  ADD COLUMN IF NOT EXISTS investment_readiness jsonb;

ALTER TABLE public.financing_applications
  ADD COLUMN IF NOT EXISTS shared_report_url text,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consultation_requested_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS readiness jsonb;