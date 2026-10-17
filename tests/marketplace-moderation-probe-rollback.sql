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
$function$
;
CREATE TEMP TABLE moderation_probe(owner_id uuid,ai_score numeric,featured boolean,view_count int,status text,review_state text,title text);
CREATE TRIGGER probe BEFORE INSERT OR UPDATE ON moderation_probe FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_property_system_fields();
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000017","role":"authenticated"}',true);
INSERT INTO moderation_probe VALUES('00000000-0000-4000-8000-000000000017',null,false,0,'published','approved','synthetic');
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM moderation_probe WHERE status='draft' AND review_state='in_review') THEN RAISE EXCEPTION 'insert bypass'; END IF; END $$;
UPDATE moderation_probe SET status='published',review_state='approved';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM moderation_probe WHERE status='draft' AND review_state='in_review') THEN RAISE EXCEPTION 'update bypass'; END IF; END $$;
ROLLBACK;