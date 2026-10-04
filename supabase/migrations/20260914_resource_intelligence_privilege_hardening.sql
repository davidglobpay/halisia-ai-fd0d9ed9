-- HALISIA Resource Intelligence M0-A privilege hardening.
-- Supabase may retain default table grants for anon/authenticated even when
-- RLS is enabled. M0-A is intentionally server-only, so revoke direct client
-- privileges explicitly and keep service_role as the only writer/reader.

REVOKE ALL ON public.resource_sources FROM anon, authenticated;
REVOKE ALL ON public.resource_observations FROM anon, authenticated;
REVOKE ALL ON public.resource_evidence_links FROM anon, authenticated;
REVOKE ALL ON public.resource_assessments FROM anon, authenticated;
REVOKE ALL ON public.resource_feature_flags FROM anon, authenticated;

GRANT ALL ON public.resource_sources TO service_role;
GRANT ALL ON public.resource_observations TO service_role;
GRANT ALL ON public.resource_evidence_links TO service_role;
GRANT ALL ON public.resource_assessments TO service_role;
GRANT ALL ON public.resource_feature_flags TO service_role;
