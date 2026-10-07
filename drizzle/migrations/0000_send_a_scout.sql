
CREATE TYPE public.scout_request_status AS ENUM ('quoted','payment_pending','payment_verified','assigned','requote_pending','in_progress','submitted','corrections_requested','completed','cancelled');
CREATE TYPE public.scout_profile_status AS ENUM ('pending','approved','suspended');
CREATE TYPE public.scout_payout_status AS ENUM ('none','pending','paid');

CREATE TABLE public.scout_price_catalog (
  code text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('base','task','access','fee')),
  label text NOT NULL,
  description text,
  amount_kes numeric NOT NULL CHECK (amount_kes >= 0),
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scout_price_catalog TO anon, authenticated;
GRANT UPDATE (amount_kes, label, description, active) ON public.scout_price_catalog TO authenticated;
GRANT ALL ON public.scout_price_catalog TO service_role;
ALTER TABLE public.scout_price_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog readable" ON public.scout_price_catalog FOR SELECT USING (true);
CREATE POLICY "admins edit catalog" ON public.scout_price_catalog FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

INSERT INTO public.scout_price_catalog (code,kind,label,description,amount_kes,sort) VALUES
 ('base','base','Base site visit','Includes 8 site photos and 1 short walkthrough video',1000,0),
 ('boundaries','task','Boundaries & access observations','Visible beacons, fences, access path (not a survey)',500,1),
 ('terrain','task','Terrain, drainage & flood indicators','Slope, standing water, drainage signs (observational only)',500,2),
 ('roads','task','Roads & transport','Road surface, matatu/boda access, distance to main road',300,3),
 ('utilities','task','Utilities & mobile signal','Visible power/water lines, signal bars by network',400,4),
 ('economic','task','Asking-price / rent interviews','Consented local interviews on prices and rents',700,5),
 ('social','task','Social amenities & local context','Schools, clinics, markets, neighbourhood character',500,6),
 ('security','task','Security observations & consented interviews','Lighting, guards, consented attributed testimony',500,7),
 ('custom','task','Custom concern','A specific question you describe',500,8),
 ('access_easy','access','Easy access allowance','Estimate, confirmed by assigned scout',0,20),
 ('access_difficult','access','Difficult access allowance','Estimate, confirmed by assigned scout',500,21),
 ('access_remote','access','Remote access allowance','Estimate, confirmed by assigned scout',1500,22),
 ('platform_fee_pct','fee','HALISIA platform fee (%)','Applied to base visit + activities only',15,30);

CREATE TABLE public.scout_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL,
  service_counties text[] NOT NULL DEFAULT '{}',
  availability text,
  bio text,
  status public.scout_profile_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.scout_profiles TO authenticated;
GRANT ALL ON public.scout_profiles TO service_role;
ALTER TABLE public.scout_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read scout profile" ON public.scout_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY "register self as scout" ON public.scout_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewer_note IS NULL);
CREATE POLICY "update own or admin" ON public.scout_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_scout_profiles_updated_at BEFORE UPDATE ON public.scout_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.scout_guard_profile_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'administrator'::public.app_role)
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.reviewer_note IS DISTINCT FROM OLD.reviewer_note) THEN
    RAISE EXCEPTION 'scout approval is administrator-controlled' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_scout_guard_profile_status BEFORE UPDATE ON public.scout_profiles FOR EACH ROW EXECUTE FUNCTION public.scout_guard_profile_status();

CREATE TABLE public.scout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  title_reference text,
  county text,
  location_source text NOT NULL,
  lat double precision,
  lng double precision,
  location_confirmed_by_buyer boolean NOT NULL DEFAULT false,
  instructions text,
  custom_concern text,
  checklist jsonb NOT NULL DEFAULT '{}',
  access_level text NOT NULL DEFAULT 'easy',
  travel_estimate_kes numeric NOT NULL DEFAULT 0,
  quote jsonb NOT NULL,
  quote_version int NOT NULL DEFAULT 1,
  quote_accepted_at timestamptz,
  pending_quote jsonb,
  status public.scout_request_status NOT NULL DEFAULT 'quoted',
  payment_reference text,
  payment_submitted_at timestamptz,
  payment_verified_at timestamptz,
  payment_verified_by uuid,
  scout_id uuid,
  conflict_disclosure text,
  claimed_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  task_results jsonb NOT NULL DEFAULT '{}',
  scout_summary text,
  block_reason text,
  evidence_exception_requested text,
  evidence_exception_approved boolean NOT NULL DEFAULT false,
  reviewer_note text,
  reviewed_by uuid,
  completed_at timestamptz,
  payout_status public.scout_payout_status NOT NULL DEFAULT 'none',
  payout_reference text,
  payout_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scout_req_access CHECK (access_level IN ('easy','difficult','remote')),
  CONSTRAINT scout_req_coords CHECK ((lat IS NULL) = (lng IS NULL))
);
CREATE INDEX scout_requests_buyer_idx ON public.scout_requests(buyer_id);
CREATE INDEX scout_requests_scout_idx ON public.scout_requests(scout_id);
CREATE INDEX scout_requests_status_idx ON public.scout_requests(status);
GRANT SELECT ON public.scout_requests TO authenticated;
GRANT ALL ON public.scout_requests TO service_role;
ALTER TABLE public.scout_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_scout_requests_updated_at BEFORE UPDATE ON public.scout_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_approved_scout(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scout_profiles p WHERE p.user_id=_uid AND p.status='approved'::public.scout_profile_status)
$$;
CREATE OR REPLACE FUNCTION public.scout_serves_county(_uid uuid, _county text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scout_profiles p WHERE p.user_id=_uid AND p.status='approved'::public.scout_profile_status
    AND (_county IS NULL OR cardinality(p.service_counties)=0 OR lower(_county) = ANY (SELECT lower(c) FROM unnest(p.service_counties) c)))
$$;
CREATE OR REPLACE FUNCTION public.is_scout_request_participant(_req uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.scout_requests r WHERE r.id=_req AND (r.buyer_id=auth.uid() OR r.scout_id=auth.uid()))
    OR public.has_role(auth.uid(),'administrator'::public.app_role)
$$;

CREATE POLICY "buyer reads own requests" ON public.scout_requests FOR SELECT TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY "scout reads assigned" ON public.scout_requests FOR SELECT TO authenticated USING (scout_id = auth.uid());
CREATE POLICY "approved scouts read open jobs" ON public.scout_requests FOR SELECT TO authenticated
  USING (status='payment_verified' AND scout_id IS NULL AND public.scout_serves_county(auth.uid(), county));
CREATE POLICY "admins read all requests" ON public.scout_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.scout_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.scout_requests(id) ON DELETE CASCADE,
  scout_id uuid NOT NULL,
  task_code text NOT NULL,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('observation','testimony','inference')),
  note text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  captured_at timestamptz NOT NULL DEFAULT now(),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  location_source text NOT NULL DEFAULT 'none' CHECK (location_source IN ('device_gps','user_entered','none')),
  interview_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scout_evidence_testimony_consent CHECK (evidence_kind <> 'testimony' OR interview_consent),
  CONSTRAINT scout_evidence_has_content CHECK (storage_path IS NOT NULL OR coalesce(btrim(note),'') <> ''),
  CONSTRAINT scout_evidence_size CHECK (size_bytes IS NULL OR size_bytes <= 52428800)
);
CREATE INDEX scout_evidence_req_idx ON public.scout_evidence(request_id);
GRANT SELECT, INSERT, DELETE ON public.scout_evidence TO authenticated;
GRANT ALL ON public.scout_evidence TO service_role;
ALTER TABLE public.scout_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read evidence" ON public.scout_evidence FOR SELECT TO authenticated USING (public.is_scout_request_participant(request_id));
CREATE POLICY "assigned scout adds evidence" ON public.scout_evidence FOR INSERT TO authenticated
  WITH CHECK (scout_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scout_requests r WHERE r.id=request_id AND r.scout_id=auth.uid() AND r.status IN ('in_progress','corrections_requested'))
    AND (storage_path IS NULL OR split_part(storage_path,'/',1) = request_id::text));
CREATE POLICY "assigned scout removes own draft evidence" ON public.scout_evidence FOR DELETE TO authenticated
  USING (scout_id = auth.uid() AND EXISTS (SELECT 1 FROM public.scout_requests r WHERE r.id=request_id AND r.scout_id=auth.uid() AND r.status IN ('in_progress','corrections_requested')));

CREATE TABLE public.scout_request_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.scout_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  event text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scout_request_events TO authenticated;
GRANT ALL ON public.scout_request_events TO service_role;
ALTER TABLE public.scout_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read events" ON public.scout_request_events FOR SELECT TO authenticated USING (public.is_scout_request_participant(request_id));

CREATE OR REPLACE FUNCTION public.scout_compute_quote(p_checklist jsonb, p_access_level text, p_travel_kes numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_base numeric; v_fee_pct numeric; v_access numeric; v_tasks numeric := 0;
  v_items jsonb := '[]'::jsonb; r record; v_choice text; v_travel numeric;
BEGIN
  IF p_access_level NOT IN ('easy','difficult','remote') THEN RAISE EXCEPTION 'invalid access level' USING ERRCODE='22023'; END IF;
  v_travel := greatest(coalesce(p_travel_kes,0),0);
  IF v_travel > 100000 THEN RAISE EXCEPTION 'travel estimate too large' USING ERRCODE='22023'; END IF;
  SELECT amount_kes INTO v_base FROM public.scout_price_catalog WHERE code='base';
  SELECT amount_kes INTO v_fee_pct FROM public.scout_price_catalog WHERE code='platform_fee_pct';
  SELECT amount_kes INTO v_access FROM public.scout_price_catalog WHERE code='access_'||p_access_level;
  FOR r IN SELECT code,label,amount_kes FROM public.scout_price_catalog WHERE kind='task' AND active ORDER BY sort LOOP
    v_choice := coalesce(p_checklist->>r.code,'not');
    IF v_choice IN ('check','unsure') THEN
      v_tasks := v_tasks + r.amount_kes;
      v_items := v_items || jsonb_build_object('code',r.code,'label',r.label,'mode',v_choice,'amount_kes',r.amount_kes);
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'currency','KES','pricing_label','Suggested pilot pricing (admin editable)',
    'base_kes',v_base,'tasks',v_items,'tasks_kes',v_tasks,
    'scout_work_kes',v_base+v_tasks,
    'travel_kes',v_travel,'access_level',p_access_level,'access_kes',v_access,
    'access_is_estimate',true,
    'platform_fee_pct',v_fee_pct,
    'platform_fee_kes',round((v_base+v_tasks)*v_fee_pct/100),
    'scout_earnings_kes',v_base+v_tasks+v_travel+v_access,
    'total_kes',v_base+v_tasks+round((v_base+v_tasks)*v_fee_pct/100)+v_travel+v_access,
    'computed_at',now());
END $$;
GRANT EXECUTE ON FUNCTION public.scout_compute_quote(jsonb,text,numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.scout_log(p_req uuid, p_event text, p_detail jsonb DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  INSERT INTO public.scout_request_events(request_id,actor_id,event,detail) VALUES (p_req,auth.uid(),p_event,p_detail)
$$;
REVOKE EXECUTE ON FUNCTION public.scout_log(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.scout_create_request(
  p_title_reference text, p_county text, p_location_source text, p_lat double precision, p_lng double precision,
  p_location_confirmed boolean, p_instructions text, p_custom_concern text, p_checklist jsonb,
  p_access_level text, p_travel_kes numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_id uuid; v_quote jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE='42501'; END IF;
  IF p_location_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'confirm the visit location first' USING ERRCODE='22023'; END IF;
  IF p_lat IS NULL AND coalesce(btrim(p_instructions),'')='' THEN
    RAISE EXCEPTION 'give coordinates/pin or directions for the scout' USING ERRCODE='22023'; END IF;
  IF p_lat IS NOT NULL AND (p_lat NOT BETWEEN -5 AND 5.5 OR p_lng NOT BETWEEN 33.5 AND 42.5) THEN
    RAISE EXCEPTION 'coordinates are outside Kenya' USING ERRCODE='22023'; END IF;
  IF p_location_source NOT IN ('manual_pin','explicit_coordinates','approximate_geocode','directions_only') THEN
    RAISE EXCEPTION 'invalid location source' USING ERRCODE='22023'; END IF;
  IF coalesce(p_checklist->>'custom','not') <> 'not' AND coalesce(btrim(p_custom_concern),'')='' THEN
    RAISE EXCEPTION 'describe the custom concern' USING ERRCODE='22023'; END IF;
  v_quote := public.scout_compute_quote(p_checklist,p_access_level,p_travel_kes);
  INSERT INTO public.scout_requests(buyer_id,title_reference,county,location_source,lat,lng,location_confirmed_by_buyer,
    instructions,custom_concern,checklist,access_level,travel_estimate_kes,quote)
  VALUES (auth.uid(),nullif(btrim(p_title_reference),''),nullif(btrim(p_county),''),p_location_source,p_lat,p_lng,true,
    nullif(btrim(p_instructions),''),nullif(btrim(p_custom_concern),''),coalesce(p_checklist,'{}'),p_access_level,
    (v_quote->>'travel_kes')::numeric,v_quote)
  RETURNING id INTO v_id;
  PERFORM public.scout_log(v_id,'created',jsonb_build_object('total_kes',v_quote->'total_kes'));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.scout_transition(p_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS public.scout_request_status LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  r public.scout_requests%ROWTYPE; v_uid uuid := auth.uid();
  v_admin boolean := public.has_role(auth.uid(),'administrator'::public.app_role);
  v_new public.scout_request_status; v_q jsonb; v_missing text[]; t text; v_rows int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.scout_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE='22023'; END IF;

  CASE p_action
  WHEN 'accept_quote' THEN
    IF r.buyer_id<>v_uid OR r.status<>'quoted' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET status='payment_pending', quote_accepted_at=now() WHERE id=p_id;
    v_new:='payment_pending';
  WHEN 'submit_payment_reference' THEN
    IF r.buyer_id<>v_uid OR r.status<>'payment_pending' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    IF coalesce(btrim(p_payload->>'reference'),'')='' OR length(p_payload->>'reference')>80 THEN RAISE EXCEPTION 'enter a payment reference' USING ERRCODE='22023'; END IF;
    UPDATE public.scout_requests SET payment_reference=btrim(p_payload->>'reference'), payment_submitted_at=now() WHERE id=p_id;
    v_new:=r.status;
  WHEN 'verify_payment' THEN
    IF NOT v_admin OR r.status<>'payment_pending' OR r.payment_reference IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    v_new := CASE WHEN r.scout_id IS NULL THEN 'payment_verified'::public.scout_request_status ELSE 'assigned'::public.scout_request_status END;
    UPDATE public.scout_requests SET status=v_new, payment_verified_at=now(), payment_verified_by=v_uid WHERE id=p_id;
  WHEN 'claim' THEN
    IF NOT public.scout_serves_county(v_uid, r.county) THEN RAISE EXCEPTION 'only approved scouts serving this county can claim' USING ERRCODE='42501'; END IF;
    IF r.buyer_id=v_uid THEN RAISE EXCEPTION 'you cannot scout your own request' USING ERRCODE='42501'; END IF;
    IF coalesce(btrim(p_payload->>'conflict_disclosure'),'')='' THEN RAISE EXCEPTION 'conflict disclosure is required (write "none" if none)' USING ERRCODE='22023'; END IF;
    UPDATE public.scout_requests SET scout_id=v_uid, status='assigned', claimed_at=now(), conflict_disclosure=btrim(p_payload->>'conflict_disclosure')
      WHERE id=p_id AND scout_id IS NULL AND status='payment_verified';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows=0 THEN RAISE EXCEPTION 'job already taken or not open' USING ERRCODE='40001'; END IF;
    v_new:='assigned';
  WHEN 'propose_requote' THEN
    IF r.scout_id IS DISTINCT FROM v_uid OR r.status<>'assigned' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    v_q := public.scout_compute_quote(r.checklist, coalesce(p_payload->>'access_level',r.access_level), coalesce((p_payload->>'travel_kes')::numeric, r.travel_estimate_kes));
    v_q := v_q || jsonb_build_object('reason', left(coalesce(p_payload->>'reason',''),500));
    UPDATE public.scout_requests SET pending_quote=v_q, status='requote_pending' WHERE id=p_id;
    v_new:='requote_pending';
  WHEN 'accept_requote' THEN
    IF r.buyer_id<>v_uid OR r.status<>'requote_pending' OR r.pending_quote IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    v_new := CASE WHEN (r.pending_quote->>'total_kes')::numeric > (r.quote->>'total_kes')::numeric
      THEN 'payment_pending'::public.scout_request_status ELSE 'assigned'::public.scout_request_status END;
    UPDATE public.scout_requests SET quote = r.pending_quote || jsonb_build_object('previous_total_kes', r.quote->'total_kes'),
      access_level=r.pending_quote->>'access_level', travel_estimate_kes=(r.pending_quote->>'travel_kes')::numeric,
      pending_quote=NULL, quote_version=r.quote_version+1, quote_accepted_at=now(), status=v_new,
      payment_reference = CASE WHEN v_new='payment_pending' THEN NULL ELSE payment_reference END WHERE id=p_id;
  WHEN 'decline_requote' THEN
    IF r.buyer_id<>v_uid OR r.status<>'requote_pending' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET pending_quote=NULL, status='assigned' WHERE id=p_id;
    v_new:='assigned';
  WHEN 'start' THEN
    IF r.scout_id IS DISTINCT FROM v_uid OR r.status<>'assigned' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET status='in_progress', started_at=now() WHERE id=p_id;
    v_new:='in_progress';
  WHEN 'save_results' THEN
    IF r.scout_id IS DISTINCT FROM v_uid OR r.status NOT IN ('in_progress','corrections_requested') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET task_results=coalesce(p_payload->'task_results','{}'::jsonb),
      scout_summary=left(p_payload->>'summary',4000), block_reason=nullif(left(p_payload->>'block_reason',1000),''),
      evidence_exception_requested=nullif(left(p_payload->>'exception',1000),'') WHERE id=p_id;
    v_new:=r.status;
  WHEN 'submit' THEN
    IF r.scout_id IS DISTINCT FROM v_uid OR r.status NOT IN ('in_progress','corrections_requested') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    v_missing := ARRAY[]::text[];
    IF NOT EXISTS (SELECT 1 FROM public.scout_evidence e WHERE e.request_id=p_id AND e.storage_path IS NOT NULL) THEN v_missing := v_missing || 'base'::text; END IF;
    FOR t IN SELECT x->>'code' FROM jsonb_array_elements(r.quote->'tasks') x LOOP
      IF NOT EXISTS (SELECT 1 FROM public.scout_evidence e WHERE e.request_id=p_id AND e.task_code=t)
         AND NOT (coalesce(r.task_results->t->>'status','')='blocked' AND coalesce(btrim(r.task_results->t->>'reason'),'')<>'') THEN
        v_missing := v_missing || t;
      END IF;
    END LOOP;
    IF cardinality(v_missing)>0 AND NOT r.evidence_exception_approved THEN
      RAISE EXCEPTION 'missing required evidence for: %', array_to_string(v_missing,', ') USING ERRCODE='22023';
    END IF;
    UPDATE public.scout_requests SET status='submitted', submitted_at=now() WHERE id=p_id;
    v_new:='submitted';
  WHEN 'approve_exception' THEN
    IF NOT v_admin OR r.evidence_exception_requested IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET evidence_exception_approved=true WHERE id=p_id;
    v_new:=r.status;
  WHEN 'request_corrections' THEN
    IF NOT v_admin OR r.status<>'submitted' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET status='corrections_requested', reviewer_note=left(p_payload->>'note',2000), reviewed_by=v_uid WHERE id=p_id;
    v_new:='corrections_requested';
  WHEN 'accept_report' THEN
    IF NOT v_admin OR r.status<>'submitted' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET status='completed', completed_at=now(), reviewed_by=v_uid,
      reviewer_note=coalesce(left(p_payload->>'note',2000),reviewer_note), payout_status='pending' WHERE id=p_id;
    v_new:='completed';
  WHEN 'mark_payout_paid' THEN
    IF NOT v_admin OR r.status<>'completed' OR r.payout_status<>'pending' THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    IF coalesce(btrim(p_payload->>'reference'),'')='' THEN RAISE EXCEPTION 'payout reference required' USING ERRCODE='22023'; END IF;
    UPDATE public.scout_requests SET payout_status='paid', payout_reference=btrim(p_payload->>'reference'), payout_paid_at=now() WHERE id=p_id;
    v_new:=r.status;
  WHEN 'cancel' THEN
    IF NOT ((r.buyer_id=v_uid AND r.status IN ('quoted','payment_pending')) OR (v_admin AND r.status NOT IN ('completed','cancelled'))) THEN
      RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET status='cancelled' WHERE id=p_id;
    v_new:='cancelled';
  WHEN 'release' THEN
    IF NOT ((r.scout_id IS NOT DISTINCT FROM v_uid AND r.status='assigned') OR (v_admin AND r.status IN ('assigned','in_progress'))) THEN
      RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
    UPDATE public.scout_requests SET scout_id=NULL, claimed_at=NULL, conflict_disclosure=NULL, status='payment_verified' WHERE id=p_id;
    v_new:='payment_verified';
  ELSE
    RAISE EXCEPTION 'unknown action' USING ERRCODE='22023';
  END CASE;
  PERFORM public.scout_log(p_id,p_action,NULL);
  RETURN v_new;
END $$;
GRANT EXECUTE ON FUNCTION public.scout_create_request(text,text,text,double precision,double precision,boolean,text,text,jsonb,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scout_transition(uuid,text,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.scout_create_request(text,text,text,double precision,double precision,boolean,text,text,jsonb,text,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.scout_transition(uuid,text,jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.my_reviewed_scout_findings(p_reference text)
RETURNS TABLE(request_id uuid, completed_at timestamptz, task_results jsonb, scout_summary text, reviewer_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT r.id, r.completed_at, r.task_results, r.scout_summary, r.reviewer_note FROM public.scout_requests r
  WHERE r.buyer_id=auth.uid() AND r.status='completed'::public.scout_request_status
    AND lower(btrim(r.title_reference))=lower(btrim(p_reference))
$$;
GRANT EXECUTE ON FUNCTION public.my_reviewed_scout_findings(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_reviewed_scout_findings(text) FROM anon;

CREATE POLICY "scout evidence upload by assigned scout" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='scout-evidence' AND EXISTS (SELECT 1 FROM public.scout_requests r
    WHERE r.id::text=(storage.foldername(name))[1] AND r.scout_id=auth.uid() AND r.status IN ('in_progress','corrections_requested')));
CREATE POLICY "scout evidence read by participants" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='scout-evidence' AND public.is_scout_request_participant(((storage.foldername(name))[1])::uuid));
CREATE POLICY "scout evidence delete by assigned scout" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='scout-evidence' AND owner_id = auth.uid()::text AND EXISTS (SELECT 1 FROM public.scout_requests r
    WHERE r.id::text=(storage.foldername(name))[1] AND r.scout_id=auth.uid() AND r.status IN ('in_progress','corrections_requested')));
