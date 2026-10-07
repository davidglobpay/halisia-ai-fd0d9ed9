INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('scout-evidence','scout-evidence',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=52428800,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE FUNCTION public.scout_guard_request_input() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF length(btrim(coalesce(NEW.county,'')))=0 THEN RAISE EXCEPTION 'Specify the service county'; END IF;
 IF length(coalesce(NEW.instructions,''))>4000 OR length(coalesce(NEW.custom_concern,''))>2000 OR length(coalesce(NEW.title_reference,''))>200 THEN RAISE EXCEPTION 'Request text is too long'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scout_request_input BEFORE INSERT ON public.scout_requests FOR EACH ROW EXECUTE FUNCTION public.scout_guard_request_input();
CREATE FUNCTION public.scout_track_overpayment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.paid_amount_kes>(NEW.quote->>'total_kes')::numeric AND NEW.status<>'cancelled' AND NEW.refund_status<>'paid' THEN
  NEW.refund_amount_kes:=NEW.paid_amount_kes-(NEW.quote->>'total_kes')::numeric;
  NEW.refund_status:='pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scout_overpayment BEFORE UPDATE ON public.scout_requests FOR EACH ROW EXECUTE FUNCTION public.scout_track_overpayment();
CREATE OR REPLACE FUNCTION public.scout_serves_county(_uid uuid, _county text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.scout_profiles p WHERE p.user_id=_uid AND p.status='approved'::public.scout_profile_status
  AND lower(regexp_replace(btrim(_county),'\s+county$','','i'))=ANY(SELECT lower(regexp_replace(btrim(c),'\s+county$','','i')) FROM unnest(p.service_counties) c))
$$;
REVOKE ALL ON FUNCTION public.scout_guard_request_input(),public.scout_track_overpayment() FROM PUBLIC,anon,authenticated;
