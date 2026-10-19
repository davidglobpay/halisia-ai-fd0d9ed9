-- Restrict decision columns without expanding any existing RLS permission.
BEGIN;
CREATE OR REPLACE FUNCTION public.halisia_guard_workflow_decisions() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $guard$
DECLARE uid uuid := auth.uid();
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='bid_proposals' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.provider_id IS DISTINCT FROM uid OR NEW.status::text<>'submitted' THEN
    RAISE EXCEPTION 'A provider may only submit a proposal' USING ERRCODE='42501'; END IF;
  ELSIF TG_OP='DELETE' THEN
   IF OLD.provider_id IS DISTINCT FROM uid OR OLD.status::text NOT IN ('submitted','withdrawn') THEN
    RAISE EXCEPTION 'A decided proposal cannot be deleted by its provider' USING ERRCODE='42501'; END IF;
   RETURN OLD;
  ELSE
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id OR NEW.bid_request_id IS DISTINCT FROM OLD.bid_request_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Proposal identity is immutable' USING ERRCODE='42501'; END IF;
   IF uid=OLD.provider_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status::text<>'withdrawn' OR OLD.status::text NOT IN ('submitted','shortlisted')) THEN
     RAISE EXCEPTION 'Only the request owner decides a proposal' USING ERRCODE='42501'; END IF;
    IF OLD.status::text NOT IN ('submitted','withdrawn') AND (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) THEN
     RAISE EXCEPTION 'Decided proposal terms cannot be rewritten' USING ERRCODE='42501'; END IF;
   ELSIF EXISTS(SELECT 1 FROM public.bid_requests b WHERE b.id=OLD.bid_request_id AND b.owner_id=uid) THEN
    IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) OR NEW.status::text NOT IN ('shortlisted','accepted','rejected') THEN
     RAISE EXCEPTION 'Request owner may only decide proposal status' USING ERRCODE='42501'; END IF;
   ELSE RAISE EXCEPTION 'Proposal access denied' USING ERRCODE='42501'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='leads' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.buyer_id IS DISTINCT FROM uid OR NEW.stage::text<>'new' OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=NEW.property_id AND p.owner_id=NEW.seller_id) THEN
    RAISE EXCEPTION 'Lead must start new for the property owner' USING ERRCODE='42501'; END IF;
  ELSIF (to_jsonb(NEW)-ARRAY['stage','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['stage','updated_at']) OR uid IS DISTINCT FROM OLD.seller_id THEN
   RAISE EXCEPTION 'Seller may only update lead stage' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='professional_requests' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.requester_id IS DISTINCT FROM uid OR NEW.status<>'new' OR NEW.confirmed_start IS NOT NULL OR NEW.confirmed_end IS NOT NULL THEN
    RAISE EXCEPTION 'Request starts unconfirmed' USING ERRCODE='42501'; END IF;
  ELSIF (to_jsonb(NEW)-ARRAY['status','confirmed_start','confirmed_end','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','confirmed_start','confirmed_end','updated_at']) OR NOT EXISTS(SELECT 1 FROM public.professional_profiles p WHERE p.id=OLD.professional_id AND p.user_id=uid) THEN
   RAISE EXCEPTION 'Professional may only update status and confirmed window' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='viewings' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.buyer_id IS DISTINCT FROM uid OR NEW.status<>'requested' OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=NEW.property_id AND p.owner_id=NEW.seller_id) THEN
    RAISE EXCEPTION 'Viewing starts requested for the property owner' USING ERRCODE='42501'; END IF;
   IF NEW.slot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.viewing_slots s WHERE s.id=NEW.slot_id AND s.property_id=NEW.property_id AND s.owner_id=NEW.seller_id AND s.start_at=NEW.scheduled_at) THEN
    RAISE EXCEPTION 'Viewing slot does not match request' USING ERRCODE='42501'; END IF;
  ELSE
   IF (to_jsonb(NEW)-ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'Viewing identity and requested time are immutable' USING ERRCODE='42501'; END IF;
   IF uid=OLD.seller_id THEN
    IF NEW.status NOT IN ('confirmed','declined','cancelled','requested') THEN RAISE EXCEPTION 'Invalid viewing status' USING ERRCODE='42501'; END IF;
   ELSIF uid=OLD.buyer_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Buyer may cancel, not confirm' USING ERRCODE='42501'; END IF;
   ELSE RAISE EXCEPTION 'Viewing access denied' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION public.halisia_guard_workflow_decisions() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER halisia_workflow_decisions BEFORE INSERT OR UPDATE OR DELETE ON public.bid_proposals FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_workflow_decisions();
CREATE TRIGGER halisia_workflow_decisions BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_workflow_decisions();
CREATE TRIGGER halisia_workflow_decisions BEFORE INSERT OR UPDATE ON public.professional_requests FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_workflow_decisions();
CREATE TRIGGER halisia_workflow_decisions BEFORE INSERT OR UPDATE ON public.viewings FOR EACH ROW EXECUTE FUNCTION public.halisia_guard_workflow_decisions();
COMMIT;
