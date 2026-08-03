
REVOKE EXECUTE ON FUNCTION public.listing_save_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.listing_save_count(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.listing_save_count(uuid) TO authenticated;
