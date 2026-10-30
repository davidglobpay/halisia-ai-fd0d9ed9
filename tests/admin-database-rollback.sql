BEGIN;
SELECT set_config('request.jwt.claims',jsonb_build_object(
 'sub','3b58cba1-2713-40aa-896c-091e9b9f8463','role','authenticated','aal','aal1',
 'session_id',(SELECT id FROM auth.sessions WHERE user_id='3b58cba1-2713-40aa-896c-091e9b9f8463' ORDER BY created_at DESC LIMIT 1))::text,true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
 IF (public.halisia_admin_status()->>'ready')::boolean THEN RAISE EXCEPTION 'MFA missing but ready'; END IF;
 BEGIN
  PERFORM public.halisia_admin_read('accounts');
  RAISE EXCEPTION 'MFA bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object(
 'sub','3b58cba1-2713-40aa-896c-091e9b9f8463','role','authenticated','aal','aal2',
 'session_id',(SELECT id FROM auth.sessions WHERE user_id='3b58cba1-2713-40aa-896c-091e9b9f8463' ORDER BY created_at DESC LIMIT 1))::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb; t text; v_target uuid; old_status text; other uuid;
BEGIN
 IF NOT (public.halisia_admin_status()->>'ready')::boolean THEN RAISE EXCEPTION 'Admin should be ready'; END IF;
 r:=public.halisia_admin_read('accounts');
 IF (r->>'total')::int<>5 THEN RAISE EXCEPTION 'Wrong account count'; END IF;
 IF r::text LIKE '%encrypted_password%' OR r::text LIKE '%refresh_token%' THEN RAISE EXCEPTION 'Secret leak'; END IF;
 PERFORM public.halisia_admin_overview();
 PERFORM public.halisia_admin_action('update_profile','3b58cba1-2713-40aa-896c-091e9b9f8463','{"display_name":"Rollback test","county":"Kajiado","phone":"","headline":""}','Rollback test profile edit');
 FOREACH t IN ARRAY ARRAY['properties','professional_profiles','contributions','scout_profiles','scout_requests',
  'scout_evidence','scout_payment_receipts','scout_service_settings','marketplace_transactions','marketplace_feature_flags',
  'financing_applications','report_versions','vault_documents','news_provider_health','news_ingestion_logs',
  'admin_allowed_emails','admin_audit_events'] LOOP
  PERFORM public.halisia_admin_read(t);
 END LOOP;
 SELECT id,status::text INTO v_target,old_status FROM public.properties LIMIT 1;
 PERFORM public.halisia_admin_action('listing_status',v_target::text,'draft','Rollback test moderation');
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=v_target AND status='draft') THEN RAISE EXCEPTION 'Moderation failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_audit_events WHERE action='listing_status' AND target=v_target::text) THEN RAISE EXCEPTION 'Missing audit'; END IF;
 BEGIN
  PERFORM public.halisia_admin_action('admin_email',(SELECT lower(email) FROM auth.users WHERE id='3b58cba1-2713-40aa-896c-091e9b9f8463'),'disable','Rollback test self removal');
  RAISE EXCEPTION 'Self revoke allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Self revoke allowed' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.halisia_admin_read('auth.users');
  RAISE EXCEPTION 'Arbitrary table access allowed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Arbitrary table access allowed' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
DO $$
DECLARE other uuid;
BEGIN
 SELECT p.id INTO other FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='administrator') LIMIT 1;
 PERFORM public.halisia_admin_action('suspend',other::text,'','Rollback test suspension');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other,'role','authenticated','aal','aal2')::text,true);
 IF public.halisia_account_active() THEN RAISE EXCEPTION 'Suspension failed'; END IF;
 BEGIN
  UPDATE public.profiles SET county='Rollback test' WHERE id=other;
  RAISE EXCEPTION 'Suspended write allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.halisia_admin_overview();
  RAISE EXCEPTION 'Ordinary account allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
