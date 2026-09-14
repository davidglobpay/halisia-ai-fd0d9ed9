-- HALISIA Resource Intelligence Foundation — additive/staged only.
-- Does not modify parcels, marketplace tables, Spatial routes or protected AR/XR assets.

CREATE TABLE IF NOT EXISTS public.resource_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority text NOT NULL,
  source_system text NOT NULL,
  source_url text NULL,
  source_class text NOT NULL CHECK (source_class IN ('model','third_party','government','field','professional','regulator')),
  licence text NULL,
  approved_method text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (authority, source_system)
);

CREATE TABLE IF NOT EXISTS public.resource_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('parcel','area','project','licence')),
  subject_ref text NOT NULL,
  parcel_id uuid NULL REFERENCES public.parcels(id) ON DELETE SET NULL,
  domain text NOT NULL CHECK (domain IN ('LAND','AGRICULTURE','MINERALS','ENERGY','WATER','CLIMATE','INFRASTRUCTURE')),
  indicator text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text NULL,
  observed_at timestamptz NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz NULL,
  valid_to timestamptz NULL,
  source_id uuid NOT NULL REFERENCES public.resource_sources(id) ON DELETE RESTRICT,
  source_record_id text NULL,
  spatial_resolution text NULL,
  temporal_resolution text NULL,
  methodology text NOT NULL,
  algorithm_version text NULL,
  model_version text NULL,
  epistemic_tier text NOT NULL DEFAULT 'UNKNOWN' CHECK (epistemic_tier IN (
    'UNKNOWN','INFERRED','OBSERVED_THIRD_PARTY','AUTHORITATIVE_SOURCE',
    'FIELD_OBSERVED','PROFESSIONALLY_REVIEWED','REGULATOR_VERIFIED'
  )),
  confidence_pct smallint NULL CHECK (confidence_pct IS NULL OR confidence_pct BETWEEN 0 AND 100),
  verification_state text NOT NULL DEFAULT 'unverified' CHECK (verification_state IN (
    'unverified','evidence_backed','professionally_reviewed','regulator_verified'
  )),
  provenance_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_record_id, indicator, retrieved_at)
);

CREATE INDEX IF NOT EXISTS resource_observations_subject_idx
  ON public.resource_observations(subject_type, subject_ref, domain, indicator);
CREATE INDEX IF NOT EXISTS resource_observations_parcel_idx
  ON public.resource_observations(parcel_id, domain, indicator);
CREATE INDEX IF NOT EXISTS resource_observations_source_idx
  ON public.resource_observations(source_id, retrieved_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_ref text NOT NULL,
  observation_id uuid NOT NULL REFERENCES public.resource_observations(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('supports','contradicts','context','blocking_gap')),
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_ref, observation_id, role)
);

CREATE TABLE IF NOT EXISTS public.resource_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('parcel','area','project','licence')),
  subject_ref text NOT NULL,
  domain text NOT NULL CHECK (domain IN ('LAND','AGRICULTURE','MINERALS','ENERGY','WATER','CLIMATE','INFRASTRUCTURE','INVESTMENT')),
  assessment_key text NOT NULL,
  state text NOT NULL DEFAULT 'NOT_ASSESSED' CHECK (state IN (
    'NOT_ASSESSED','INSUFFICIENT_EVIDENCE','PRELIMINARY','SCREENED','PROFESSIONALLY_REVIEWED','INVESTMENT_READY'
  )),
  score numeric NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  confidence_pct smallint NULL CHECK (confidence_pct IS NULL OR confidence_pct BETWEEN 0 AND 100),
  coverage numeric NULL CHECK (coverage IS NULL OR (coverage >= 0 AND coverage <= 1)),
  missing_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology text NOT NULL,
  methodology_version text NOT NULL,
  generated_by text NOT NULL CHECK (generated_by IN ('deterministic','ai','professional','regulator')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT resource_assessment_score_gate CHECK (
    state NOT IN ('NOT_ASSESSED','INSUFFICIENT_EVIDENCE') OR score IS NULL
  )
);

CREATE INDEX IF NOT EXISTS resource_assessments_subject_idx
  ON public.resource_assessments(subject_type, subject_ref, domain, assessment_key, generated_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.resource_feature_flags(key, enabled, description) VALUES
  ('resource_intelligence', false, 'Shared resource intelligence foundation'),
  ('limar', false, 'Agriculture, climate, soil and water intelligence'),
  ('madini', false, 'Minerals and mining intelligence'),
  ('energy_intelligence', false, 'Solar, wind, geothermal, grid and storage intelligence'),
  ('evidence_graph', false, 'Traceable assessment-to-observation evidence graph'),
  ('investment_passport', false, 'Investment Passport surfaces'),
  ('opportunity_engine', false, 'Evidence-gated opportunity discovery'),
  ('halisia_invest', false, 'Institutional investment interface')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.resource_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_feature_flags ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.resource_sources TO service_role;
GRANT ALL ON public.resource_observations TO service_role;
GRANT ALL ON public.resource_evidence_links TO service_role;
GRANT ALL ON public.resource_assessments TO service_role;
GRANT ALL ON public.resource_feature_flags TO service_role;

CREATE POLICY "service role manages resource sources" ON public.resource_sources
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages resource observations" ON public.resource_observations
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages resource evidence links" ON public.resource_evidence_links
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages resource assessments" ON public.resource_assessments
FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages resource flags" ON public.resource_feature_flags
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Guard: AI/model/third-party records can never claim regulator verification.
CREATE OR REPLACE FUNCTION public.halisia_guard_resource_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_class text;
BEGIN
  SELECT s.source_class INTO v_class FROM public.resource_sources s WHERE s.id = NEW.source_id;
  IF NEW.epistemic_tier = 'REGULATOR_VERIFIED'
     AND v_class IS DISTINCT FROM 'regulator' THEN
    RAISE EXCEPTION 'regulator verification requires a regulator-class source' USING ERRCODE = '42501';
  END IF;
  IF NEW.verification_state = 'regulator_verified'
     AND v_class IS DISTINCT FROM 'regulator' THEN
    RAISE EXCEPTION 'regulator_verified state requires a regulator-class source' USING ERRCODE = '42501';
  END IF;
  IF v_class = 'model' AND NEW.epistemic_tier NOT IN ('UNKNOWN','INFERRED') THEN
    RAISE EXCEPTION 'model output may not self-promote beyond INFERRED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.halisia_guard_resource_verification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_halisia_guard_resource_verification ON public.resource_observations;
CREATE TRIGGER trg_halisia_guard_resource_verification
BEFORE INSERT OR UPDATE ON public.resource_observations
FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_resource_verification();
