REVOKE ALL ON FUNCTION public.is_source_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_source_member(uuid) TO authenticated, service_role;