BEGIN;
CREATE SCHEMA IF NOT EXISTS halisia_private;
REVOKE ALL ON SCHEMA halisia_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA halisia_private TO authenticated;
CREATE TABLE IF NOT EXISTS public.admin_allowed_emails (
 email text PRIMARY KEY CHECK(email=lower(btrim(email))), enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_account_controls (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), suspended boolean NOT NULL DEFAULT false,
 reason text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), actor_id uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text NOT NULL,
 target text NOT NULL, reason text NOT NULL, before_data jsonb, after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_allowed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_account_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_allowed_emails,public.admin_account_controls,public.admin_audit_events FROM anon,authenticated;
GRANT SELECT ON public.admin_allowed_emails,public.admin_account_controls,public.admin_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.halisia_account_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.admin_account_controls c WHERE c.user_id=auth.uid() AND c.suspended)
$$;
REVOKE ALL ON FUNCTION public.halisia_account_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.halisia_account_active() TO anon,authenticated;
-- The reviewed findings read can rely on buyer RLS; do not bypass suspension.
ALTER FUNCTION public.my_reviewed_scout_findings(text) SECURITY INVOKER;

CREATE OR REPLACE FUNCTION halisia_private.reject_suspended_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.halisia_account_active() THEN
  RAISE EXCEPTION 'Account app access is suspended' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION halisia_private.reject_suspended_write() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=_user_id AND r.role=_role)
 AND NOT EXISTS(SELECT 1 FROM public.admin_account_controls c WHERE c.user_id=_user_id AND c.suspended)
 AND (_role<>'administrator' OR (
  _user_id=auth.uid() AND auth.jwt()->>'aal'='aal2'
  AND EXISTS(SELECT 1 FROM auth.users u JOIN public.admin_allowed_emails a ON a.email=lower(u.email)
    WHERE u.id=_user_id AND u.email_confirmed_at IS NOT NULL AND a.enabled)
  AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=_user_id AND s.id::text=auth.jwt()->>'session_id')
 ))
$$;

CREATE OR REPLACE FUNCTION halisia_private.assert_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'administrator'),false) THEN
  RAISE EXCEPTION 'Administrator allowlist, confirmed account and active MFA session required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION halisia_private.assert_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION halisia_private.assert_admin() TO authenticated;

CREATE OR REPLACE FUNCTION halisia_private.admin_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('eligible',
  EXISTS(SELECT 1 FROM auth.users u JOIN public.admin_allowed_emails a ON a.email=lower(u.email)
    JOIN public.user_roles r ON r.user_id=u.id AND r.role='administrator'
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND a.enabled)
  AND public.halisia_account_active(),
  'ready',coalesce(public.has_role(auth.uid(),'administrator'),false))
$$;
CREATE OR REPLACE FUNCTION public.halisia_admin_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT halisia_private.admin_status() $$;
REVOKE ALL ON FUNCTION halisia_private.admin_status(),public.halisia_admin_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION halisia_private.admin_status(),public.halisia_admin_status() TO authenticated;

CREATE OR REPLACE FUNCTION halisia_private.activate_allowed_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.email_confirmed_at IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.admin_allowed_emails a WHERE a.email=lower(NEW.email) AND a.enabled
 ) THEN
  INSERT INTO public.user_roles(user_id,role) VALUES(NEW.id,'administrator') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION halisia_private.activate_allowed_admin() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS halisia_activate_allowed_admin ON auth.users;
CREATE TRIGGER halisia_activate_allowed_admin AFTER INSERT OR UPDATE OF email,email_confirmed_at ON auth.users
 FOR EACH ROW EXECUTE FUNCTION halisia_private.activate_allowed_admin();

CREATE OR REPLACE FUNCTION halisia_private.guard_admin_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role='administrator' AND NOT EXISTS(
  SELECT 1 FROM auth.users u JOIN public.admin_allowed_emails a ON a.email=lower(u.email)
  WHERE u.id=NEW.user_id AND u.email_confirmed_at IS NOT NULL AND a.enabled
 ) THEN RAISE EXCEPTION 'Only confirmed allowlisted accounts may be administrators'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION halisia_private.guard_admin_grant() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS halisia_guard_admin_grant ON public.user_roles;
CREATE TRIGGER halisia_guard_admin_grant BEFORE INSERT OR UPDATE ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION halisia_private.guard_admin_grant();

INSERT INTO public.admin_allowed_emails(email) VALUES
 ('ceo@globpay.ai'),('sammyosore64@gmail.com'),('osoredavid644@gmail.com'),
 ('dicksonnandwa4@gmail.com'),('osoredickson04@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role)
 SELECT u.id,'administrator'::public.app_role FROM auth.users u
 JOIN public.admin_allowed_emails a ON a.email=lower(u.email)
 WHERE u.email_confirmed_at IS NOT NULL AND a.enabled ON CONFLICT DO NOTHING;

DO $$
DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('DROP POLICY IF EXISTS halisia_active_account ON public.%I',t.tablename);
  EXECUTE format('CREATE POLICY halisia_active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.halisia_account_active()) WITH CHECK(public.halisia_account_active())',t.tablename);
  IF t.tablename NOT IN ('admin_account_controls','admin_audit_events') THEN
   EXECUTE format('DROP TRIGGER IF EXISTS halisia_reject_suspended_write ON public.%I',t.tablename);
   EXECUTE format('CREATE TRIGGER halisia_reject_suspended_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION halisia_private.reject_suspended_write()',t.tablename);
  END IF;
 END LOOP;
 FOR t IN SELECT unnest(ARRAY['profiles','properties','property_media','leads','viewings','viewing_slots',
 'professional_profiles','professional_requests','professional_reviews','contributions','financing_applications',
 'insurance_briefs','saved_items','saved_searches','report_versions','report_collections','report_collection_items',
 'report_shares','vault_documents','vault_document_shares','parcels','parcel_verification_events','resource_observations',
 'resource_assessments','admin_allowed_emails','admin_account_controls','admin_audit_events']) AS tablename LOOP
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t.tablename);
  EXECUTE format('DROP POLICY IF EXISTS halisia_master_admin_read ON public.%I',t.tablename);
  EXECUTE format('CREATE POLICY halisia_master_admin_read ON public.%I FOR SELECT TO authenticated USING(public.has_role(auth.uid(),''administrator''))',t.tablename);
 END LOOP;
END $$;
DROP POLICY IF EXISTS halisia_admin_role_no_direct_insert ON public.user_roles;
CREATE POLICY halisia_admin_role_no_direct_insert ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(role<>'administrator');
DROP POLICY IF EXISTS halisia_admin_role_no_direct_delete ON public.user_roles;
CREATE POLICY halisia_admin_role_no_direct_delete ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
 USING(role<>'administrator');
DROP POLICY IF EXISTS halisia_active_account ON storage.objects;
CREATE POLICY halisia_active_account ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.halisia_account_active()) WITH CHECK(public.halisia_account_active());
DROP POLICY IF EXISTS halisia_admin_private_media ON storage.objects;
CREATE POLICY halisia_admin_private_media ON storage.objects FOR SELECT TO authenticated
 USING(public.has_role(auth.uid(),'administrator'));

CREATE OR REPLACE FUNCTION halisia_private.admin_read(p_table text,p_offset int DEFAULT 0,p_user uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; total bigint; predicate text:=''; owner_col text; ordering text;
BEGIN
 PERFORM halisia_private.assert_admin();
 IF p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Invalid page'; END IF;
 IF p_table='accounts' THEN
  SELECT jsonb_agg(x) INTO result FROM (
   SELECT u.id,u.email,u.email_confirmed_at,u.created_at,u.last_sign_in_at,
    p.display_name,p.county,p.phone,p.headline,coalesce(c.suspended,false) suspended,c.reason suspension_reason,
    (SELECT coalesce(jsonb_agg(r.role),'[]') FROM public.user_roles r WHERE r.user_id=u.id) roles
   FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
   LEFT JOIN public.admin_account_controls c ON c.user_id=u.id
   WHERE p_user IS NULL OR u.id=p_user ORDER BY u.created_at DESC,u.id LIMIT 50 OFFSET p_offset
  ) x;
  SELECT count(*) INTO total FROM auth.users WHERE p_user IS NULL OR id=p_user;
 ELSE
  IF NOT p_table=ANY(ARRAY['profiles','properties','property_media','leads','viewings','professional_profiles',
   'professional_requests','professional_reviews','contributions','financing_applications','insurance_briefs',
   'saved_items','saved_searches','report_versions','report_collections','report_shares','vault_documents',
   'parcels','parcel_verification_events','resource_observations','resource_assessments','scout_profiles',
   'scout_requests','scout_evidence','scout_payment_receipts','scout_request_events','scout_price_catalog',
   'scout_service_settings','marketplace_transactions','marketplace_commissions','marketplace_payouts',
   'marketplace_sources','marketplace_external_listings','marketplace_leads','marketplace_feature_flags',
   'news_provider_health','news_ingestion_logs','news_sources','news_articles','admin_audit_events',
   'admin_allowed_emails','admin_account_controls','user_roles',
   'architectural_prototypes','article_media','bid_proposals','bid_requests','listing_versions',
   'location_intel_slices','marketplace_listing_price_history','marketplace_partner_agreements',
   'marketplace_referral_events','marketplace_referrals','marketplace_source_members','marketplace_source_sync_runs',
   'marketplace_verification_evidence','news_audio','news_categories','news_clusters','news_locations','news_tags',
   'parcel_beacons','property_media','rental_details','renter_preferences','report_collection_items',
   'resource_evidence_links','resource_feature_flags','resource_sources','saved_articles','trending_scores',
   'vault_document_shares','viewing_slots']) THEN RAISE EXCEPTION 'Unsupported resource'; END IF;
  IF p_user IS NOT NULL THEN
   owner_col:=CASE p_table WHEN 'profiles' THEN 'id' WHEN 'properties' THEN 'owner_id'
    WHEN 'professional_profiles' THEN 'user_id' WHEN 'contributions' THEN 'user_id'
    WHEN 'saved_items' THEN 'user_id' WHEN 'saved_searches' THEN 'user_id'
    WHEN 'report_versions' THEN 'owner_id' WHEN 'report_collections' THEN 'owner_id'
    WHEN 'vault_documents' THEN 'owner_id' WHEN 'financing_applications' THEN 'applicant_id'
    WHEN 'scout_profiles' THEN 'user_id' WHEN 'user_roles' THEN 'user_id' ELSE NULL END;
   IF p_table='scout_requests' THEN predicate:=format('WHERE buyer_id=%L::uuid OR scout_id=%L::uuid',p_user,p_user);
   ELSIF p_table='leads' THEN predicate:=format('WHERE buyer_id=%L::uuid OR seller_id=%L::uuid',p_user,p_user);
   ELSIF owner_col IS NULL THEN RAISE EXCEPTION 'Account filter unsupported for resource';
   ELSE predicate:=format('WHERE %I=%L::uuid',owner_col,p_user); END IF;
  END IF;
  ordering:=CASE
   WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='created_at') THEN 'created_at DESC'
   WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name='updated_at') THEN 'updated_at DESC'
   ELSE '1' END;
  EXECUTE format('SELECT coalesce(jsonb_agg(x),''[]'') FROM (SELECT * FROM public.%I %s ORDER BY %s LIMIT 50 OFFSET %s)x',p_table,predicate,ordering,p_offset) INTO result;
  EXECUTE format('SELECT count(*) FROM public.%I %s',p_table,predicate) INTO total;
 END IF;
 RETURN jsonb_build_object('rows',coalesce(result,'[]'),'total',total,'offset',p_offset);
END $$;
CREATE OR REPLACE FUNCTION public.halisia_admin_read(p_table text,p_offset int DEFAULT 0,p_user uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT halisia_private.admin_read(p_table,p_offset,p_user) $$;
REVOKE ALL ON FUNCTION halisia_private.admin_read(text,int,uuid),public.halisia_admin_read(text,int,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION halisia_private.admin_read(text,int,uuid),public.halisia_admin_read(text,int,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION halisia_private.admin_overview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM halisia_private.assert_admin();
 RETURN jsonb_build_object(
 'accounts',(SELECT count(*) FROM auth.users),'profiles',(SELECT count(*) FROM public.profiles),
 'properties',(SELECT count(*) FROM public.properties),'professionals',(SELECT count(*) FROM public.professional_profiles),
 'scouts',(SELECT count(*) FROM public.scout_profiles),'scout_jobs',(SELECT count(*) FROM public.scout_requests),
 'contributions_pending',(SELECT count(*) FROM public.contributions WHERE status='pending'),
 'news_articles',(SELECT count(*) FROM public.news_articles),'ingestion_logs',(SELECT count(*) FROM public.news_ingestion_logs),
 'payments_enabled',(SELECT payments_enabled FROM public.scout_service_settings LIMIT 1),
 'scout_receipts_kes',(SELECT coalesce(sum(amount_kes),0) FROM public.scout_payment_receipts),
 'audit_events',(SELECT count(*) FROM public.admin_audit_events),
 'captured_at',now());
END $$;
CREATE OR REPLACE FUNCTION public.halisia_admin_overview() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT halisia_private.admin_overview() $$;
REVOKE ALL ON FUNCTION halisia_private.admin_overview(),public.halisia_admin_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION halisia_private.admin_overview(),public.halisia_admin_overview() TO authenticated;

CREATE OR REPLACE FUNCTION halisia_private.admin_action(p_action text,p_target text,p_value text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb; after_row jsonb; v_uid uuid; v_role public.app_role; v_email text; v_id uuid; v_ok boolean;
BEGIN
 PERFORM halisia_private.assert_admin();
 IF length(btrim(p_reason))<5 OR length(p_reason)>2000 THEN RAISE EXCEPTION 'Enter a reason (5-2000 characters)'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('halisia_admin_control'));
 IF p_action IN ('suspend','restore') THEN
  v_uid:=p_target::uuid;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_uid) THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role='administrator') THEN
   RAISE EXCEPTION 'Revoke administrator access before suspending this account';
  END IF;
  SELECT to_jsonb(c) INTO before_row FROM public.admin_account_controls c WHERE user_id=v_uid;
  INSERT INTO public.admin_account_controls(user_id,suspended,reason,actor_id)
   VALUES(v_uid,p_action='suspend',p_reason,auth.uid())
   ON CONFLICT(user_id) DO UPDATE SET suspended=excluded.suspended,reason=excluded.reason,actor_id=excluded.actor_id,updated_at=now();
  SELECT to_jsonb(c) INTO after_row FROM public.admin_account_controls c WHERE user_id=v_uid;
 ELSIF p_action IN ('grant_role','revoke_role') THEN
  v_uid:=p_target::uuid; v_role:=p_value::public.app_role;
  IF v_role='administrator' THEN RAISE EXCEPTION 'Manage administrator access through the email allowlist'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_uid) THEN RAISE EXCEPTION 'Account not found'; END IF;
  SELECT coalesce(jsonb_agg(role),'[]') INTO before_row FROM public.user_roles WHERE user_id=v_uid;
  IF p_action='grant_role' THEN
   INSERT INTO public.user_roles(user_id,role) VALUES(v_uid,v_role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.user_roles WHERE user_id=v_uid AND role=v_role; END IF;
  SELECT coalesce(jsonb_agg(role),'[]') INTO after_row FROM public.user_roles WHERE user_id=v_uid;
 ELSIF p_action='admin_email' THEN
  v_email:=lower(btrim(p_target));
  IF v_email !~ '^[a-z0-9.!#$%&*+/=?^_{}|~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' OR length(v_email)>255 THEN RAISE EXCEPTION 'Enter a complete email address'; END IF;
  IF p_value NOT IN ('enable','disable') THEN RAISE EXCEPTION 'Invalid allowlist action'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND lower(email)=v_email) AND p_value='disable' THEN
   RAISE EXCEPTION 'Cannot revoke your own administrator access';
  END IF;
  SELECT to_jsonb(a) INTO before_row FROM public.admin_allowed_emails a WHERE email=v_email;
  INSERT INTO public.admin_allowed_emails(email,enabled) VALUES(v_email,p_value='enable')
   ON CONFLICT(email) DO UPDATE SET enabled=excluded.enabled;
  IF p_value='enable' THEN
   INSERT INTO public.user_roles(user_id,role) SELECT id,'administrator'::public.app_role FROM auth.users
    WHERE lower(email)=v_email AND email_confirmed_at IS NOT NULL ON CONFLICT DO NOTHING;
  ELSE
   DELETE FROM public.user_roles WHERE role='administrator' AND user_id IN(SELECT id FROM auth.users WHERE lower(email)=v_email);
  END IF;
  SELECT to_jsonb(a) INTO after_row FROM public.admin_allowed_emails a WHERE email=v_email;
 ELSIF p_action='update_profile' THEN
  v_uid:=p_target::uuid;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_uid) THEN RAISE EXCEPTION 'Account not found'; END IF;
  after_row:=p_value::jsonb;
  IF jsonb_typeof(after_row)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(after_row) k WHERE k NOT IN ('display_name','county','phone','headline')) THEN
   RAISE EXCEPTION 'Unsupported profile fields';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(after_row) e WHERE jsonb_typeof(e.value) NOT IN ('string','null') OR length(e.value#>>'{}')>512) THEN RAISE EXCEPTION 'Invalid profile values'; END IF;
  SELECT to_jsonb(p) INTO before_row FROM public.profiles p WHERE id=v_uid FOR UPDATE;
  INSERT INTO public.profiles(id,display_name,county,phone,headline)
   VALUES(v_uid,after_row->>'display_name',after_row->>'county',after_row->>'phone',after_row->>'headline')
   ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,county=excluded.county,phone=excluded.phone,headline=excluded.headline;
  SELECT to_jsonb(p) INTO after_row FROM public.profiles p WHERE id=v_uid;
 ELSIF p_action='document_access' THEN
  v_id:=p_target::uuid;
  IF p_value='vault_documents' THEN SELECT to_jsonb(d) INTO after_row FROM public.vault_documents d WHERE id=v_id;
  ELSIF p_value='scout_evidence' THEN SELECT to_jsonb(d) INTO after_row FROM public.scout_evidence d WHERE id=v_id;
  ELSE RAISE EXCEPTION 'Unsupported private file'; END IF;
  IF after_row IS NULL OR after_row->>'storage_path' IS NULL THEN RAISE EXCEPTION 'No private file attached'; END IF;
 ELSIF p_action='listing_status' THEN
  IF p_value NOT IN ('draft','published','sold','rented','archived') THEN RAISE EXCEPTION 'Invalid listing status'; END IF;
  v_id:=p_target::uuid; SELECT to_jsonb(p) INTO before_row FROM public.properties p WHERE id=v_id FOR UPDATE;
  IF before_row IS NULL THEN RAISE EXCEPTION 'Listing not found'; END IF;
  UPDATE public.properties SET status=p_value::public.property_status WHERE id=v_id;
  SELECT to_jsonb(p) INTO after_row FROM public.properties p WHERE id=v_id;
 ELSIF p_action='contribution_review' THEN
  IF p_value NOT IN ('accepted','rejected','pending') THEN RAISE EXCEPTION 'Invalid review status'; END IF;
  v_id:=p_target::uuid; SELECT to_jsonb(c) INTO before_row FROM public.contributions c WHERE id=v_id FOR UPDATE;
  IF before_row IS NULL THEN RAISE EXCEPTION 'Contribution not found'; END IF;
  UPDATE public.contributions SET status=p_value,reviewer_note=p_reason WHERE id=v_id;
  SELECT to_jsonb(c) INTO after_row FROM public.contributions c WHERE id=v_id;
 ELSIF p_action='professional_review' THEN
  IF p_value NOT IN ('verified','pending','unverified') THEN RAISE EXCEPTION 'Invalid professional review'; END IF;
  v_id:=p_target::uuid; SELECT to_jsonb(p) INTO before_row FROM public.professional_profiles p WHERE id=v_id FOR UPDATE;
  IF before_row IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p_value='verified' AND coalesce(before_row->'verification_evidence','null') IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) THEN
   RAISE EXCEPTION 'Review submitted credential evidence before verification';
  END IF;
  UPDATE public.professional_profiles SET verification_status=p_value::public.pro_verification,
   verification_note=p_reason,verified_at=CASE WHEN p_value='verified' THEN now() ELSE NULL END WHERE id=v_id;
  SELECT to_jsonb(p) INTO after_row FROM public.professional_profiles p WHERE id=v_id;
 ELSIF p_action='feature_flag' THEN
  IF p_value NOT IN ('true','false') THEN RAISE EXCEPTION 'Invalid feature setting'; END IF;
  SELECT to_jsonb(f) INTO before_row FROM public.marketplace_feature_flags f WHERE key=p_target FOR UPDATE;
  IF before_row IS NULL THEN RAISE EXCEPTION 'Unknown feature'; END IF;
  UPDATE public.marketplace_feature_flags SET enabled=p_value::boolean WHERE key=p_target;
  SELECT to_jsonb(f) INTO after_row FROM public.marketplace_feature_flags f WHERE key=p_target;
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 INSERT INTO public.admin_audit_events(actor_id,action,target,reason,before_data,after_data)
 VALUES(auth.uid(),p_action,p_target,p_reason,before_row,after_row);
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.halisia_admin_action(p_action text,p_target text,p_value text,p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT halisia_private.admin_action(p_action,p_target,p_value,p_reason) $$;
REVOKE ALL ON FUNCTION halisia_private.admin_action(text,text,text,text),public.halisia_admin_action(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION halisia_private.admin_action(text,text,text,text),public.halisia_admin_action(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION halisia_private.audit_existing_admin_tools() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(public.has_role(auth.uid(),'administrator'),false) THEN
  INSERT INTO public.admin_audit_events(actor_id,action,target,reason,before_data,after_data)
   VALUES(auth.uid(),TG_OP,TG_TABLE_NAME,'Administrator workflow change; review associated workflow history',
    CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) ELSE NULL END);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION halisia_private.audit_existing_admin_tools() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['properties','professional_profiles','contributions','user_roles',
  'scout_profiles','scout_requests','scout_price_catalog','scout_service_settings','scout_payment_receipts',
  'marketplace_transactions','marketplace_commissions','marketplace_payouts','marketplace_feature_flags'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS halisia_audit_admin_change ON public.%I',t);
  EXECUTE format('CREATE TRIGGER halisia_audit_admin_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION halisia_private.audit_existing_admin_tools()',t);
 END LOOP;
END $$;
INSERT INTO public.admin_audit_events(action,target,reason,after_data)
VALUES('bootstrap_allowlist','administrator accounts','User authorized supplied screenshot accounts; exact addresses readable or matched to confirmed app accounts',
 '{"emails":["ceo@globpay.ai","sammyosore64@gmail.com","osoredavid644@gmail.com","dicksonnandwa4@gmail.com","osoredickson04@gmail.com"],"requires_mfa":true}');
COMMIT;
