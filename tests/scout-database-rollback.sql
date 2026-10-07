BEGIN;
INSERT INTO public.scout_profiles(user_id,display_name,service_counties,status) VALUES('11111111-1111-4111-8111-111111111111','Rollback QA scout',ARRAY['Kajiado'],'approved');
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_id uuid; failed boolean:=false; q jsonb;
BEGIN
 q:=public.scout_compute_quote('{"boundaries":"check","terrain":"check","roads":"unsure","utilities":"check","economic":"check","social":"check","security":"check","custom":"check"}','easy',0);
 IF (q->>'total_kes')::numeric<>5635 THEN RAISE EXCEPTION 'pricing mismatch'; END IF;
 IF has_function_privilege('anon','public.scout_transition(uuid,text,jsonb)','execute') OR has_function_privilege('authenticated','public.scout_transition_internal(uuid,text,jsonb)','execute') THEN RAISE EXCEPTION 'function privilege leak'; END IF;
 IF has_table_privilege('authenticated','public.scout_requests','update') THEN RAISE EXCEPTION 'direct state mutation allowed'; END IF;
 BEGIN PERFORM public.scout_compute_quote('{"fake":"check"}','easy',0); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'unknown task accepted'; END IF; failed:=false;
 BEGIN PERFORM public.scout_compute_quote('{}','easy',-20); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'negative travel accepted'; END IF;
 v_id:=public.scout_create_request('ROLLBACK-QA','Kajiado','explicit_coordinates',-1.75,37.1,true,'QA directions','','{}','easy',0);
 PERFORM set_config('qa.scout_request',v_id::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.scout_requests WHERE scout_requests.id=v_id) THEN RAISE EXCEPTION 'buyer cannot read own request'; END IF;
 failed:=false;
 BEGIN PERFORM public.scout_transition(v_id,'accept_quote','{}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'payments enabled without instructions'; END IF;
END $$;
RESET ROLE;
UPDATE public.scout_requests SET status='payment_verified' WHERE id=current_setting('qa.scout_request')::uuid;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_id uuid:=current_setting('qa.scout_request')::uuid; failed boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.scout_requests WHERE scout_requests.id=v_id) THEN RAISE EXCEPTION 'eligible scout cannot read job'; END IF;
 PERFORM public.scout_transition(v_id,'claim','{"conflict_disclosure":"none"}');
 BEGIN PERFORM public.scout_transition(v_id,'claim','{"conflict_disclosure":"none"}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'duplicate claim accepted'; END IF;
 PERFORM public.scout_transition(v_id,'start','{}');
 PERFORM public.scout_transition(v_id,'save_results','{"task_results":{"base":{"status":"observed","note":"Site inspected"}},"summary":"Rollback QA summary with sufficient detail."}');
 failed:=false;
 BEGIN PERFORM public.scout_transition(v_id,'submit','{}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'report accepted without actual photos/video'; END IF;
 failed:=false;
 BEGIN INSERT INTO public.scout_evidence(request_id,scout_id,task_code,evidence_kind,note,storage_path,mime_type,size_bytes) VALUES(v_id,auth.uid(),'base','observation','QA fake file',v_id::text||'/fake.jpg','image/jpeg',20); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'phantom media accepted'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.scout_requests WHERE id=current_setting('qa.scout_request')::uuid) THEN RAISE EXCEPTION 'cross-buyer data leak'; END IF;
 IF EXISTS(SELECT 1 FROM public.scout_request_events WHERE request_id=current_setting('qa.scout_request')::uuid) THEN RAISE EXCEPTION 'cross-buyer event leak'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: pricing, quote-only mode, RLS buyer/scout access, privilege guards, duplicate claim, media requirement, phantom-file rejection; fixtures rolled back' AS result;
