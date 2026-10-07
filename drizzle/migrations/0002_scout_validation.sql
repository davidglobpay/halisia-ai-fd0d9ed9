ALTER TABLE public.scout_price_catalog ADD CONSTRAINT scout_fee_range CHECK(kind<>'fee' OR amount_kes<=100);
ALTER FUNCTION public.scout_compute_quote(jsonb,text,numeric) RENAME TO scout_compute_quote_internal;
REVOKE ALL ON FUNCTION public.scout_compute_quote_internal(jsonb,text,numeric) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.scout_compute_quote(p_checklist jsonb,p_access_level text,p_travel_kes numeric) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; v text;
BEGIN
 IF jsonb_typeof(coalesce(p_checklist,'{}'))<>'object' THEN RAISE EXCEPTION 'Invalid checklist'; END IF;
 IF p_travel_kes IS NULL OR p_travel_kes<0 OR p_travel_kes>100000 OR p_travel_kes::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid travel cost'; END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each_text(coalesce(p_checklist,'{}')) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.scout_price_catalog WHERE code=k AND kind='task' AND active) THEN RAISE EXCEPTION 'Unknown or unavailable activity: %',k; END IF;
  IF v NOT IN ('not','check','unsure') THEN RAISE EXCEPTION 'Invalid checklist choice'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.scout_price_catalog WHERE code='base' AND active) OR NOT EXISTS(SELECT 1 FROM public.scout_price_catalog WHERE code='platform_fee_pct' AND active) OR NOT EXISTS(SELECT 1 FROM public.scout_price_catalog WHERE code='access_'||p_access_level AND active) THEN RAISE EXCEPTION 'Pricing unavailable'; END IF;
 RETURN public.scout_compute_quote_internal(p_checklist,p_access_level,p_travel_kes);
END $$;
REVOKE ALL ON FUNCTION public.scout_compute_quote(jsonb,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scout_compute_quote(jsonb,text,numeric) TO anon,authenticated;
-- No arbitrary JSON payload or private findings are included in public activity logs.
REVOKE ALL ON FUNCTION public.scout_guard_evidence() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.scout_guard_profile_status() FROM PUBLIC,anon,authenticated;
