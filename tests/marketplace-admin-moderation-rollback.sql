BEGIN;
CREATE OR REPLACE FUNCTION public.halisia_guard_property_system_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = NEW.owner_id
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF TG_OP='INSERT' THEN
      IF NEW.ai_score IS NOT NULL OR NEW.featured IS DISTINCT FROM false OR coalesce(NEW.view_count,0) <> 0 THEN
        RAISE EXCEPTION 'listing score, featured state and view counters are system-controlled' USING ERRCODE='42501';
      END IF;
      IF NEW.status::text = 'published' OR NEW.review_state::text = 'approved' THEN
        NEW.status := 'draft'; NEW.review_state := 'in_review';
      END IF;
    ELSIF TG_OP='UPDATE' THEN
      IF NEW.ai_score IS DISTINCT FROM OLD.ai_score
         OR NEW.featured IS DISTINCT FROM OLD.featured
         OR NEW.view_count IS DISTINCT FROM OLD.view_count THEN
        RAISE EXCEPTION 'listing score, featured state and view counters are system-controlled' USING ERRCODE='42501';
      END IF;
      IF NEW.status::text = 'published' OR OLD.review_state::text = 'approved' OR NEW.review_state::text = 'approved' THEN
        NEW.status := 'draft'; NEW.review_state := 'in_review';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION halisia_private.admin_action(p_action text, p_target text, p_value text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  UPDATE public.properties SET status=p_value::public.property_status,
 review_state=CASE WHEN p_value='published' THEN 'approved' ELSE 'in_review' END WHERE id=v_id;
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
END $function$
;


INSERT INTO public.admin_allowed_emails(email) VALUES ('halisia-release-qa@example.invalid');
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('00000000-0000-4000-8000-000000000027','halisia-release-qa@example.invalid',now()),('00000000-0000-4000-8000-000000000028','halisia-owner-qa@example.invalid',now());
INSERT INTO auth.sessions(id,user_id) VALUES ('00000000-0000-4000-8000-000000000029','00000000-0000-4000-8000-000000000027');
INSERT INTO public.properties(id,owner_id,kind,title) VALUES('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000028','land','Synthetic release QA - rollback');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000027","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000029"}',true);
DO $$ BEGIN IF NOT public.has_role(auth.uid(),'administrator') THEN RAISE EXCEPTION 'Synthetic admin setup failed'; END IF; END $$;
SELECT public.halisia_admin_action('listing_status','00000000-0000-4000-8000-000000000030','published','Synthetic release QA rollback');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id='00000000-0000-4000-8000-000000000030' AND status='published' AND review_state='approved') THEN RAISE EXCEPTION 'Admin approval failed'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000028","role":"authenticated","aal":"aal1"}',true);
UPDATE public.properties SET title='Synthetic edited content' WHERE id='00000000-0000-4000-8000-000000000030';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id='00000000-0000-4000-8000-000000000030' AND status='draft' AND review_state='in_review') THEN RAISE EXCEPTION 'Seller edit not requeued'; END IF; END $$;
ROLLBACK;