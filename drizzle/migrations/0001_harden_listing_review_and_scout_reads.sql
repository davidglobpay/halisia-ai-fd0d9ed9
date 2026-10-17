CREATE OR REPLACE FUNCTION public.halisia_guard_property_system_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = NEW.owner_id
     AND NOT public.has_role(auth.uid(), 'administrator'::public.app_role) THEN
    IF TG_OP='INSERT' THEN
      IF NEW.ai_score IS NOT NULL OR NEW.featured IS DISTINCT FROM false OR coalesce(NEW.view_count,0) <> 0 THEN
        RAISE EXCEPTION 'listing score, featured state and view counters are system-controlled' USING ERRCODE='42501';
      END IF;
      IF NEW.review_state::text = 'approved' THEN
        NEW.review_state := 'in_review';
      END IF;
    ELSIF TG_OP='UPDATE' THEN
      IF NEW.ai_score IS DISTINCT FROM OLD.ai_score
         OR NEW.featured IS DISTINCT FROM OLD.featured
         OR NEW.view_count IS DISTINCT FROM OLD.view_count THEN
        RAISE EXCEPTION 'listing score, featured state and view counters are system-controlled' USING ERRCODE='42501';
      END IF;
      IF NEW.review_state::text = 'approved' AND OLD.review_state IS DISTINCT FROM NEW.review_state THEN
        NEW.review_state := OLD.review_state;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "catalog readable" ON public.scout_price_catalog;
CREATE POLICY "active catalog readable" ON public.scout_price_catalog
  FOR SELECT USING (active OR public.has_role(auth.uid(), 'administrator'::public.app_role));

DROP POLICY IF EXISTS "signed in read scout settings" ON public.scout_service_settings;
CREATE POLICY "signed in read scout settings" ON public.scout_service_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);