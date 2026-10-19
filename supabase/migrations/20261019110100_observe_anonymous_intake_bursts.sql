-- Fail-open anonymous intake burst monitoring. No personal identifiers are stored.
-- This detects bursts; enforcement needs a trusted client identity at the edge.
BEGIN;
CREATE SCHEMA IF NOT EXISTS halisia_private;
CREATE TABLE IF NOT EXISTS halisia_private.intake_bursts (
 endpoint text NOT NULL CHECK (endpoint IN ('lead','referral')),
 bucket timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 1,
 alerted boolean NOT NULL DEFAULT false,
 PRIMARY KEY(endpoint,bucket)
);
ALTER TABLE halisia_private.intake_bursts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON halisia_private.intake_bursts FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION halisia_private.observe_intake(p_endpoint text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $observe$
DECLARE v_count integer; v_limit integer;
BEGIN
 IF auth.uid() IS NOT NULL THEN RETURN; END IF;
 v_limit := CASE p_endpoint WHEN 'lead' THEN 30 WHEN 'referral' THEN 120 ELSE NULL END;
 IF v_limit IS NULL THEN RETURN; END IF;
 INSERT INTO halisia_private.intake_bursts(endpoint,bucket) VALUES(p_endpoint,date_trunc('minute',now()))
 ON CONFLICT(endpoint,bucket) DO UPDATE SET attempts=intake_bursts.attempts+1
 RETURNING attempts INTO v_count;
 IF v_count = v_limit + 1 THEN
  UPDATE halisia_private.intake_bursts SET alerted=true WHERE endpoint=p_endpoint AND bucket=date_trunc('minute',now());
  RAISE LOG 'HALISIA anonymous intake burst: endpoint=%, threshold=% per minute; enquiries continue to be accepted', p_endpoint, v_limit;
 END IF;
 IF v_count=1 THEN DELETE FROM halisia_private.intake_bursts WHERE bucket < now()-interval '2 days'; END IF;
EXCEPTION WHEN OTHERS THEN
 RAISE LOG 'HALISIA intake monitor unavailable; accepting enquiry (SQLSTATE %)', SQLSTATE;
END $observe$;
REVOKE ALL ON FUNCTION halisia_private.observe_intake(text) FROM PUBLIC,anon,authenticated;
DO $lease$ BEGIN IF pg_get_functiondef('public.mkt_create_lead(text,boolean,text,text,text,text,uuid,uuid,boolean)'::regprocedure) IS DISTINCT FROM 'CREATE OR REPLACE FUNCTION public.mkt_create_lead(p_full_name text, p_consent_partner_contact boolean, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_enquiry_type text DEFAULT ''enquiry''::text, p_external_listing_id uuid DEFAULT NULL::uuid, p_referral_id uuid DEFAULT NULL::uuid, p_consent_marketing boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE
  v_source_id uuid;
  v_now timestamptz := now();
  v_ref public.marketplace_referrals%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_consent_partner_contact IS NOT TRUE THEN
    RAISE EXCEPTION ''partner contact consent is required'' USING ERRCODE = ''42501'';
  END IF;
  IF coalesce(btrim(p_full_name), '''') = '''' THEN
    RAISE EXCEPTION ''full name is required'' USING ERRCODE = ''22023'';
  END IF;
  IF coalesce(btrim(p_email), '''') = '''' AND coalesce(btrim(p_phone), '''') = '''' THEN
    RAISE EXCEPTION ''an email address or phone number is required'' USING ERRCODE = ''22023'';
  END IF;

  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION ''listing not available'' USING ERRCODE = ''22023'';
    END IF;
  END IF;

  IF p_referral_id IS NOT NULL THEN
    SELECT * INTO v_ref FROM public.marketplace_referrals r WHERE r.id = p_referral_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION ''referral not found'' USING ERRCODE = ''22023'';
    END IF;
    IF v_ref.user_id IS NOT NULL AND v_ref.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION ''referral does not belong to this session'' USING ERRCODE = ''42501'';
    END IF;
    IF p_external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS DISTINCT FROM p_external_listing_id THEN
      RAISE EXCEPTION ''referral does not match this listing'' USING ERRCODE = ''22023'';
    END IF;
    IF v_source_id IS NULL THEN v_source_id := v_ref.source_id; END IF;
    IF v_ref.source_id IS NOT NULL AND v_source_id IS DISTINCT FROM v_ref.source_id THEN
      RAISE EXCEPTION ''referral does not match this source'' USING ERRCODE = ''22023'';
    END IF;
  END IF;

  INSERT INTO public.marketplace_leads (
    referral_id, source_id, external_listing_id, user_id,
    full_name, email, phone, message, enquiry_type,
    consent_partner_contact, consent_partner_contact_at,
    consent_marketing, consent_marketing_at,
    consent_receipt, status, assigned_to
  ) VALUES (
    p_referral_id, v_source_id, p_external_listing_id, auth.uid(),
    btrim(p_full_name), nullif(btrim(p_email), ''''), nullif(btrim(p_phone), ''''),
    nullif(btrim(p_message), ''''), coalesce(nullif(btrim(p_enquiry_type), ''''), ''enquiry''),
    true, v_now,
    coalesce(p_consent_marketing, false),
    CASE WHEN coalesce(p_consent_marketing, false) THEN v_now ELSE NULL END,
    jsonb_build_object(
      ''recorded_at'', v_now,
      ''method'', ''halisia_web_form'',
      ''consent_partner_contact'', true,
      ''consent_marketing'', coalesce(p_consent_marketing, false),
      ''authenticated'', auth.uid() IS NOT NULL
    ),
    ''new''::public.mkt_lead_status, NULL
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$
' THEN RAISE EXCEPTION 'Intake function changed; review before applying'; END IF; END $lease$;
CREATE OR REPLACE FUNCTION public.mkt_create_lead(p_full_name text, p_consent_partner_contact boolean, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_enquiry_type text DEFAULT 'enquiry'::text, p_external_listing_id uuid DEFAULT NULL::uuid, p_referral_id uuid DEFAULT NULL::uuid, p_consent_marketing boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_source_id uuid;
  v_now timestamptz := now();
  v_ref public.marketplace_referrals%ROWTYPE;
  v_id uuid;
BEGIN
  PERFORM halisia_private.observe_intake('lead');
  IF p_consent_partner_contact IS NOT TRUE THEN
    RAISE EXCEPTION 'partner contact consent is required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'full name is required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(btrim(p_email), '') = '' AND coalesce(btrim(p_phone), '') = '' THEN
    RAISE EXCEPTION 'an email address or phone number is required' USING ERRCODE = '22023';
  END IF;

  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION 'listing not available' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_referral_id IS NOT NULL THEN
    SELECT * INTO v_ref FROM public.marketplace_referrals r WHERE r.id = p_referral_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'referral not found' USING ERRCODE = '22023';
    END IF;
    IF v_ref.user_id IS NOT NULL AND v_ref.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'referral does not belong to this session' USING ERRCODE = '42501';
    END IF;
    IF p_external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS NOT NULL
       AND v_ref.external_listing_id IS DISTINCT FROM p_external_listing_id THEN
      RAISE EXCEPTION 'referral does not match this listing' USING ERRCODE = '22023';
    END IF;
    IF v_source_id IS NULL THEN v_source_id := v_ref.source_id; END IF;
    IF v_ref.source_id IS NOT NULL AND v_source_id IS DISTINCT FROM v_ref.source_id THEN
      RAISE EXCEPTION 'referral does not match this source' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.marketplace_leads (
    referral_id, source_id, external_listing_id, user_id,
    full_name, email, phone, message, enquiry_type,
    consent_partner_contact, consent_partner_contact_at,
    consent_marketing, consent_marketing_at,
    consent_receipt, status, assigned_to
  ) VALUES (
    p_referral_id, v_source_id, p_external_listing_id, auth.uid(),
    btrim(p_full_name), nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''),
    nullif(btrim(p_message), ''), coalesce(nullif(btrim(p_enquiry_type), ''), 'enquiry'),
    true, v_now,
    coalesce(p_consent_marketing, false),
    CASE WHEN coalesce(p_consent_marketing, false) THEN v_now ELSE NULL END,
    jsonb_build_object(
      'recorded_at', v_now,
      'method', 'halisia_web_form',
      'consent_partner_contact', true,
      'consent_marketing', coalesce(p_consent_marketing, false),
      'authenticated', auth.uid() IS NOT NULL
    ),
    'new'::public.mkt_lead_status, NULL
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

DO $lease$ BEGIN IF pg_get_functiondef('public.mkt_create_referral(uuid,uuid,uuid)'::regprocedure) IS DISTINCT FROM 'CREATE OR REPLACE FUNCTION public.mkt_create_referral(p_source_id uuid DEFAULT NULL::uuid, p_external_listing_id uuid DEFAULT NULL::uuid, p_property_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, referral_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE
  v_source_id uuid := p_source_id;
  v_window int := 30;
  v_code text := replace(gen_random_uuid()::text, ''-'', '''');
  v_row public.marketplace_referrals%ROWTYPE;
BEGIN
  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION ''listing not available'' USING ERRCODE = ''22023'';
    END IF;
  ELSIF v_source_id IS NOT NULL THEN
    PERFORM 1 FROM public.marketplace_sources s WHERE s.id = v_source_id AND s.active;
    IF NOT FOUND THEN
      RAISE EXCEPTION ''source not available'' USING ERRCODE = ''22023'';
    END IF;
  END IF;

  INSERT INTO public.marketplace_referrals (
    referral_code, source_id, external_listing_id, property_id,
    user_id, session_hash, attribution_window_days, expires_at
  ) VALUES (
    v_code, v_source_id, p_external_listing_id, p_property_id,
    auth.uid(), md5(v_code), v_window, now() + (v_window || '' days'')::interval
  ) RETURNING * INTO v_row;

  id := v_row.id; referral_code := v_row.referral_code; expires_at := v_row.expires_at;
  RETURN NEXT;
END;
$function$
' THEN RAISE EXCEPTION 'Intake function changed; review before applying'; END IF; END $lease$;
CREATE OR REPLACE FUNCTION public.mkt_create_referral(p_source_id uuid DEFAULT NULL::uuid, p_external_listing_id uuid DEFAULT NULL::uuid, p_property_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, referral_code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_source_id uuid := p_source_id;
  v_window int := 30;
  v_code text := replace(gen_random_uuid()::text, '-', '');
  v_row public.marketplace_referrals%ROWTYPE;
BEGIN
  PERFORM halisia_private.observe_intake('referral');
  IF p_external_listing_id IS NOT NULL THEN
    SELECT l.source_id INTO v_source_id
    FROM public.marketplace_external_listings l
    JOIN public.marketplace_sources s ON s.id = l.source_id
    WHERE l.id = p_external_listing_id AND l.active AND s.active;
    IF v_source_id IS NULL THEN
      RAISE EXCEPTION 'listing not available' USING ERRCODE = '22023';
    END IF;
  ELSIF v_source_id IS NOT NULL THEN
    PERFORM 1 FROM public.marketplace_sources s WHERE s.id = v_source_id AND s.active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'source not available' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.marketplace_referrals (
    referral_code, source_id, external_listing_id, property_id,
    user_id, session_hash, attribution_window_days, expires_at
  ) VALUES (
    v_code, v_source_id, p_external_listing_id, p_property_id,
    auth.uid(), md5(v_code), v_window, now() + (v_window || ' days')::interval
  ) RETURNING * INTO v_row;

  id := v_row.id; referral_code := v_row.referral_code; expires_at := v_row.expires_at;
  RETURN NEXT;
END;
$function$;

COMMIT;

