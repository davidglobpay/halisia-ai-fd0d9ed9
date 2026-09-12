REVOKE ALL ON FUNCTION public.halisia_guard_parcel_verification_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mkt_guard_partner_lead_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_verification_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_verified_surveyor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_surveyor(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_privileged_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_privileged_role(public.app_role) TO authenticated, service_role;