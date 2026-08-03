ALTER TABLE public.professional_profiles
  ADD COLUMN IF NOT EXISTS verification_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS availability_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.professional_requests
  ADD COLUMN IF NOT EXISTS preferred_start timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_end timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_start timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_end timestamptz;

ALTER TABLE public.saved_items DROP CONSTRAINT IF EXISTS saved_items_kind_check;
ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_kind_check
  CHECK (kind = ANY (ARRAY['location'::text,'county'::text,'property'::text,'match'::text]));