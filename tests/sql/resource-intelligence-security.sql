BEGIN;

CREATE TEMP TABLE _ri_check(name text, ok boolean);

INSERT INTO _ri_check VALUES
('resource flags default off', NOT EXISTS (SELECT 1 FROM public.resource_feature_flags WHERE enabled)),
('RLS resource observations', (SELECT relrowsecurity FROM pg_class WHERE oid='public.resource_observations'::regclass)),
('RLS resource assessments', (SELECT relrowsecurity FROM pg_class WHERE oid='public.resource_assessments'::regclass)),
('no authenticated direct write observations', NOT has_table_privilege('authenticated','public.resource_observations','INSERT')),
('score withheld when insufficient evidence', EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname='resource_assessment_score_gate'
)),
('verification guard installed', EXISTS (
  SELECT 1 FROM pg_trigger WHERE tgrelid='public.resource_observations'::regclass
    AND tgname='trg_halisia_guard_resource_verification' AND NOT tgisinternal
));

SELECT * FROM _ri_check ORDER BY name;
SELECT count(*) AS total, count(*) FILTER (WHERE ok) AS passed,
       count(*) FILTER (WHERE NOT ok) AS failed FROM _ri_check;
ROLLBACK;
