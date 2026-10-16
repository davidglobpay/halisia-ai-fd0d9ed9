-- Security hardening only; no records changed and no new admin access granted.
BEGIN;
CREATE SCHEMA IF NOT EXISTS halisia_private;
DO $lease$
BEGIN
 IF to_regprocedure('halisia_private.guard_financing_status()') IS NOT NULL THEN
  IF md5(pg_get_functiondef('halisia_private.guard_financing_status()'::regprocedure)) NOT IN ('7d2068e919f89a12dbb5e6f145e64fca', '76c2c55ccc0ba367605ad16adc2ae51e') THEN
   RAISE EXCEPTION 'Financing guard changed since review; inspect before applying';
  END IF;
 END IF;
END $lease$;
CREATE OR REPLACE FUNCTION halisia_private.guard_financing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE caller uuid := auth.uid(); protected_status boolean;
BEGIN
 IF caller IS NULL THEN RETURN NEW; END IF;
 protected_status := NEW.status IN ('under_review','approved','funded','rejected');
 IF protected_status AND NOT public.has_role(caller,'administrator'::public.app_role) THEN
  IF TG_OP='INSERT' THEN
   RAISE EXCEPTION 'Financing decision status requires an authorized backend process' USING ERRCODE='42501';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   RAISE EXCEPTION 'Financing decision status requires an authorized backend process' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END; $fn$;
DROP TRIGGER IF EXISTS halisia_guard_financing_status ON public.financing_applications;
CREATE TRIGGER halisia_guard_financing_status BEFORE INSERT OR UPDATE ON public.financing_applications FOR EACH ROW EXECUTE FUNCTION halisia_private.guard_financing_status();
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.financing_applications FROM anon, authenticated;
COMMIT;
