ALTER TABLE public.scout_requests ADD COLUMN refund_amount_kes numeric NOT NULL DEFAULT 0 CHECK(refund_amount_kes>=0);
CREATE OR REPLACE FUNCTION public.scout_transition(p_id uuid,p_action text,p_payload jsonb DEFAULT '{}') RETURNS public.scout_request_status LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.scout_requests%ROWTYPE; v_admin boolean; v_uid uuid:=auth.uid(); v_amount numeric; v_reference text; v_photos int; v_videos int; v_next public.scout_request_status; t text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE='42501'; END IF;
 v_admin:=public.has_role(v_uid,'administrator');
 SELECT * INTO r FROM public.scout_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
 IF p_action IN ('accept_quote','submit_payment_reference','verify_payment') AND NOT EXISTS(SELECT 1 FROM public.scout_service_settings WHERE payments_enabled) THEN RAISE EXCEPTION 'Quote-only service: payment instructions have not been configured'; END IF;
 IF p_action IN ('start','save_results','submit','propose_requote') AND NOT public.is_approved_scout(v_uid) THEN RAISE EXCEPTION 'Approved scout account required' USING ERRCODE='42501'; END IF;
 IF p_action='verify_payment' THEN
   IF NOT v_admin OR r.status<>'payment_pending' OR r.payment_reference IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
   v_reference:=upper(btrim(r.payment_reference));
   v_amount:=(p_payload->>'amount_kes')::numeric;
   IF v_amount IS NULL OR v_amount<=0 OR v_amount>1000000 THEN RAISE EXCEPTION 'Enter the actual received amount'; END IF;
   INSERT INTO public.scout_payment_receipts(reference,request_id,amount_kes,verified_by) VALUES(v_reference,p_id,v_amount,v_uid);
   UPDATE public.scout_requests SET paid_amount_kes=paid_amount_kes+v_amount WHERE id=p_id RETURNING * INTO r;
   IF r.paid_amount_kes < (r.quote->>'total_kes')::numeric THEN
     UPDATE public.scout_requests SET payment_reference=NULL WHERE id=p_id;
     PERFORM public.scout_log(p_id,'partial_payment_verified',jsonb_build_object('amount_kes',v_amount));
     RETURN r.status;
   END IF;
 ELSIF p_action='save_results' THEN
   IF jsonb_typeof(p_payload->'task_results') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Task results must be an object'; END IF;
   IF length(coalesce(p_payload->>'summary',''))>4000 THEN RAISE EXCEPTION 'Summary exceeds 4000 characters'; END IF;
   FOR t IN SELECT jsonb_object_keys(p_payload->'task_results') LOOP
     IF t<>'base' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.quote->'tasks') x WHERE x->>'code'=t) THEN RAISE EXCEPTION 'Task not requested'; END IF;
     IF coalesce(p_payload->'task_results'->t->>'status','') NOT IN ('observed','blocked') THEN RAISE EXCEPTION 'Invalid task status'; END IF;
     IF p_payload->'task_results'->t->>'status'='blocked' AND length(btrim(coalesce(p_payload->'task_results'->t->>'reason','')))=0 THEN RAISE EXCEPTION 'Blocked task needs a reason'; END IF;
   END LOOP;
   UPDATE public.scout_requests SET evidence_exception_approved=false WHERE id=p_id;
 ELSIF p_action='submit' THEN
   IF r.scout_id IS DISTINCT FROM v_uid OR r.status NOT IN ('in_progress','corrections_requested') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
   IF length(btrim(coalesce(r.scout_summary,'')))<20 THEN RAISE EXCEPTION 'Provide a useful site summary'; END IF;
   SELECT count(*) FILTER(WHERE e.mime_type LIKE 'image/%'), count(*) FILTER(WHERE e.mime_type LIKE 'video/%') INTO v_photos,v_videos
    FROM public.scout_evidence e JOIN storage.objects o ON o.bucket_id='scout-evidence' AND o.name=e.storage_path WHERE e.request_id=p_id AND e.task_code='base';
   IF (v_photos<8 OR v_videos<1) AND NOT r.evidence_exception_approved THEN RAISE EXCEPTION 'Base visit requires 8 actual photos and 1 video; request a reviewed exception if blocked'; END IF;
   FOR t IN SELECT x->>'code' FROM jsonb_array_elements(r.quote->'tasks') x LOOP
     IF NOT (r.task_results ? t) THEN RAISE EXCEPTION 'Complete the findings for %',t; END IF;
   END LOOP;
 ELSIF p_action='approve_exception' THEN
   IF NOT v_admin OR r.status NOT IN ('in_progress','corrections_requested') OR length(btrim(coalesce(p_payload->>'note','')))<5 THEN RAISE EXCEPTION 'Admin review reason is required'; END IF;
 ELSIF p_action IN ('accept_report','request_corrections') THEN
   IF NOT v_admin OR r.scout_id=v_uid OR r.buyer_id=v_uid THEN RAISE EXCEPTION 'An independent administrator must review the report' USING ERRCODE='42501'; END IF;
   IF length(btrim(coalesce(p_payload->>'note','')))<5 THEN RAISE EXCEPTION 'Review note is required'; END IF;
 ELSIF p_action='mark_refund_paid' THEN
   IF NOT v_admin OR r.refund_status<>'pending' OR length(btrim(coalesce(p_payload->>'reference','')))<3 THEN RAISE EXCEPTION 'Refund reference required'; END IF;
   UPDATE public.scout_requests SET refund_status='paid',refund_reference=btrim(p_payload->>'reference'),paid_amount_kes=greatest(0,paid_amount_kes-refund_amount_kes) WHERE id=p_id;
   PERFORM public.scout_log(p_id,p_action,jsonb_build_object('reference',p_payload->>'reference'));
   RETURN r.status;
 END IF;
 v_next:=public.scout_transition_internal(p_id,p_action,p_payload);
 IF p_action='accept_requote' THEN
   UPDATE public.scout_requests SET status=CASE WHEN paid_amount_kes >= (quote->>'total_kes')::numeric THEN 'assigned'::public.scout_request_status ELSE 'payment_pending'::public.scout_request_status END,
    refund_status=CASE WHEN paid_amount_kes>(quote->>'total_kes')::numeric THEN 'pending' ELSE 'none' END, refund_amount_kes=greatest(0,paid_amount_kes-(quote->>'total_kes')::numeric) WHERE id=p_id RETURNING status INTO v_next;
 ELSIF p_action='cancel' AND r.paid_amount_kes>0 THEN
   UPDATE public.scout_requests SET refund_status='pending',refund_amount_kes=paid_amount_kes WHERE id=p_id;
 ELSIF p_action='request_corrections' THEN
   UPDATE public.scout_requests SET evidence_exception_approved=false WHERE id=p_id;
 END IF;
 IF p_action='approve_exception' THEN PERFORM public.scout_log(p_id,'exception_review',jsonb_build_object('note',p_payload->>'note')); END IF;
 RETURN v_next;
END $$;

CREATE OR REPLACE FUNCTION public.scout_guard_media_type() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE metadata jsonb;
BEGIN
 IF NEW.storage_path IS NOT NULL THEN
  SELECT o.metadata INTO metadata FROM storage.objects o WHERE o.bucket_id='scout-evidence' AND o.name=NEW.storage_path;
  IF metadata IS NULL OR metadata->>'mimetype' IS DISTINCT FROM NEW.mime_type OR (metadata->>'size')::bigint IS DISTINCT FROM NEW.size_bytes THEN RAISE EXCEPTION 'Evidence metadata must match the uploaded file'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scout_match_uploaded_file BEFORE INSERT ON public.scout_evidence FOR EACH ROW EXECUTE FUNCTION public.scout_guard_media_type();
REVOKE ALL ON FUNCTION public.scout_guard_media_type() FROM PUBLIC,anon,authenticated;
