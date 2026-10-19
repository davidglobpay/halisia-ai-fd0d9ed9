-- Preserve the production privilege reductions and harden qualified RPC paths.
BEGIN;
DO $revoke$
DECLARE r record;
BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM anon, authenticated, PUBLIC', r.tablename);
 END LOOP;
END $revoke$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated, PUBLIC;
ALTER FUNCTION public.pulse_provider_status() SET search_path='';
ALTER FUNCTION public.is_source_member(uuid) SET search_path='';
ALTER FUNCTION public.listing_save_count(uuid) SET search_path='';
COMMIT;

