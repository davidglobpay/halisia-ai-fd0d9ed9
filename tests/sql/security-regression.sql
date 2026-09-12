-- HALISIA.AI security regression harness (35 checks).
-- Runs inside a single transaction and ALWAYS rolls back: no fixtures remain.
-- Usage: run the whole file as one statement batch with a privileged role.

BEGIN;

CREATE TEMP TABLE _chk (n int, name text, ok boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.rec(_n int, _name text, _ok boolean, _detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _chk VALUES (_n, _name, coalesce(_ok, false), _detail)
$$;

CREATE OR REPLACE FUNCTION pg_temp.pol(_table text, _name text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=_table AND policyname=_name)
$$;

-- ---------------------------------------------------------------- structural

-- Prior marketplace security cases -------------------------------------------
SELECT pg_temp.rec(1, 'referral_events: no broad insert policy',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketplace_referral_events' AND cmd='INSERT'));

SELECT pg_temp.rec(2, 'referrals: legacy "insert any" policy removed',
  NOT pg_temp.pol('marketplace_referrals','referrals insert any'));

SELECT pg_temp.rec(3, 'referrals: no anon/authenticated direct insert',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketplace_referrals' AND cmd='INSERT'));

SELECT pg_temp.rec(4, 'leads: legacy "insert with consent" policy removed',
  NOT pg_temp.pol('marketplace_leads','leads insert with consent'));

SELECT pg_temp.rec(5, 'leads: no anon/authenticated direct insert',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketplace_leads' AND cmd='INSERT'));

SELECT pg_temp.rec(6, 'mkt_create_lead exists and is SECURITY DEFINER',
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mkt_create_lead' AND p.prosecdef));

SELECT pg_temp.rec(7, 'mkt_create_referral exists and is SECURITY DEFINER',
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mkt_create_referral' AND p.prosecdef));

SELECT pg_temp.rec(8, 'anon may execute mkt_create_lead',
  has_function_privilege('anon',
    'public.mkt_create_lead(text,boolean,text,text,text,text,uuid,uuid,boolean)', 'EXECUTE'));

SELECT pg_temp.rec(9, 'anon may execute mkt_create_referral',
  has_function_privilege('anon', 'public.mkt_create_referral(uuid,uuid,uuid)', 'EXECUTE'));

SELECT pg_temp.rec(10, 'partner lead update guard trigger installed',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.marketplace_leads'::regclass
    AND tgname='trg_mkt_guard_partner_lead_update' AND NOT tgisinternal));

SELECT pg_temp.rec(11, 'partner lead guard function not callable by anon/authenticated',
  NOT has_function_privilege('anon','public.mkt_guard_partner_lead_update()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.mkt_guard_partner_lead_update()','EXECUTE'));

SELECT pg_temp.rec(12, 'partners retain scoped lead update policy',
  pg_temp.pol('marketplace_leads','leads partner update own source'));

SELECT pg_temp.rec(13, 'administrators retain full lead control',
  pg_temp.pol('marketplace_leads','leads admin all'));

SELECT pg_temp.rec(14, 'external listings public read is gated on active source',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='marketplace_external_listings'
    AND policyname='ext listings public read active' AND qual LIKE '%s.active%'));

SELECT pg_temp.rec(15, 'sources public read limited to active sources',
  pg_temp.pol('marketplace_sources','sources public read active'));

SELECT pg_temp.rec(16, 'professional verification guard trigger installed',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.professional_profiles'::regclass
    AND tgname='trg_halisia_guard_professional_verification' AND NOT tgisinternal));

SELECT pg_temp.rec(17, 'contribution review guard trigger installed',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.contributions'::regclass
    AND tgname='trg_halisia_guard_contribution_review_fields' AND NOT tgisinternal));

-- Role and parcel-verification controls --------------------------------------
SELECT pg_temp.rec(18, 'user_roles: legacy "add own roles" policy removed',
  NOT pg_temp.pol('user_roles','add own roles'));

SELECT pg_temp.rec(19, 'user_roles insert policy blocks privileged roles',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles'
    AND cmd='INSERT' AND with_check LIKE '%is_privileged_role%'));

SELECT pg_temp.rec(20, 'user_roles delete policy blocks privileged roles',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles'
    AND cmd='DELETE' AND qual LIKE '%is_privileged_role%'));

SELECT pg_temp.rec(21, 'surveyor is privileged', public.is_privileged_role('surveyor'));
SELECT pg_temp.rec(22, 'buyer is not privileged', NOT public.is_privileged_role('buyer'));
SELECT pg_temp.rec(23, 'administrator is privileged', public.is_privileged_role('administrator'));

SELECT pg_temp.rec(24, 'is_verified_surveyor is SECURITY DEFINER with fixed search_path',
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='is_verified_surveyor' AND p.prosecdef
      AND p.proconfig IS NOT NULL));

SELECT pg_temp.rec(25, 'legacy self-declared surveyor insert policy removed',
  NOT pg_temp.pol('parcel_verification_events','Reviewers can record verification events'));

SELECT pg_temp.rec(26, 'verification events require admin or verified surveyor',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='parcel_verification_events' AND cmd='INSERT'
    AND with_check LIKE '%is_verified_surveyor%' AND with_check LIKE '%actor_id%'));

SELECT pg_temp.rec(27, 'verification actor stamped by trigger',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.parcel_verification_events'::regclass
    AND tgname='trg_stamp_verification_actor' AND NOT tgisinternal));

SELECT pg_temp.rec(28, 'parcel verification field guard trigger installed',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.parcels'::regclass
    AND tgname='trg_halisia_guard_parcel_verification_fields' AND NOT tgisinternal));

SELECT pg_temp.rec(29, 'all new security-definer routines pin search_path',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND p.proconfig IS NULL
      AND p.proname IN ('mkt_create_lead','mkt_create_referral','mkt_guard_partner_lead_update',
        'stamp_verification_actor','is_verified_surveyor',
        'halisia_guard_parcel_verification_fields')));

SELECT pg_temp.rec(30, 'RLS enabled on all hardened tables',
  NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT c.relrowsecurity
      AND c.relname IN ('user_roles','parcels','parcel_verification_events',
        'marketplace_referrals','marketplace_referral_events','marketplace_leads',
        'professional_profiles','contributions')));

-- --------------------------------------------------------------- behavioural
DO $harness$
DECLARE
  v_user uuid;
  v_other uuid := gen_random_uuid();
  v_parcel uuid;
  v_lead uuid;
  v_status text;
  v_ok boolean;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user IS NULL THEN
    PERFORM pg_temp.rec(31, 'owner cannot edit parcel verification state', false, 'no auth user fixture available');
    PERFORM pg_temp.rec(32, 'owner can still edit ordinary parcel metadata', false, 'no auth user fixture available');
    PERFORM pg_temp.rec(33, 'non-authority user cannot record verification event', false, 'no auth user fixture available');
    PERFORM pg_temp.rec(34, 'mkt_create_lead rejects missing consent', false, 'no auth user fixture available');
    PERFORM pg_temp.rec(35, 'lead is server-stamped and PII is partner-immutable', false, 'no auth user fixture available');
    RETURN;
  END IF;

  INSERT INTO public.parcels (title_deed_no, parcel_code, owner_id, county,
    centroid_lat, centroid_lng, geometry, area_sqm, zoning_type)
  VALUES ('TEST/REG/1', 'TEST-REG-1', v_user, 'Testland',
    -1.0, 37.0, '{"type":"Polygon","coordinates":[]}'::jsonb, 1000, 'residential')
  RETURNING id INTO v_parcel;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- 31: verification fields are authority-controlled
  v_ok := false;
  BEGIN
    UPDATE public.parcels SET verification_state = 'verified', verification_confidence = 99
    WHERE id = v_parcel;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  PERFORM pg_temp.rec(31, 'owner cannot edit parcel verification state', v_ok);

  -- 32: ordinary owner workflow still works
  v_ok := false;
  BEGIN
    UPDATE public.parcels SET zoning_type = 'commercial' WHERE id = v_parcel;
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN v_ok := false;
  END;
  PERFORM pg_temp.rec(32, 'owner can still edit ordinary parcel metadata', v_ok);

  -- 34: consent is mandatory
  v_ok := false;
  BEGIN
    PERFORM public.mkt_create_lead('Regression Tester', false, 'reg@example.test');
  EXCEPTION WHEN OTHERS THEN v_ok := true;
  END;
  PERFORM pg_temp.rec(34, 'mkt_create_lead rejects missing consent', v_ok);

  -- 35: server stamping + partner cannot rewrite PII
  v_lead := public.mkt_create_lead('Regression Tester', true, 'reg@example.test');
  SELECT status::text INTO v_status FROM public.marketplace_leads WHERE id = v_lead;
  v_ok := v_status = 'new'
    AND EXISTS (SELECT 1 FROM public.marketplace_leads
      WHERE id = v_lead AND consent_partner_contact
        AND consent_partner_contact_at IS NOT NULL
        AND assigned_to IS NULL
        AND consent_receipt ? 'recorded_at');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other)::text, true);
  BEGIN
    UPDATE public.marketplace_leads SET email = 'attacker@example.test' WHERE id = v_lead;
    v_ok := false;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.rec(35, 'lead is server-stamped and PII is partner-immutable', v_ok);

  -- 33: RLS blocks a non-authority actor from recording verification events
  v_ok := false;
  BEGIN
    SET LOCAL ROLE authenticated;
    BEGIN
      INSERT INTO public.parcel_verification_events (parcel_id, to_state, method)
      VALUES (v_parcel, 'verified', 'self-claim');
    EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
    END;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN RESET ROLE;
  END;
  PERFORM pg_temp.rec(33, 'non-authority user cannot record verification event', v_ok);
END
$harness$;

SELECT n, name, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM _chk ORDER BY n;

SELECT count(*) AS checks_total,
       count(*) FILTER (WHERE ok) AS checks_passed,
       count(*) FILTER (WHERE NOT ok) AS checks_failed
FROM _chk;

ROLLBACK;
