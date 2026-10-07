-- Supabase default table grants are broader than GRANT SELECT: revoke explicitly.
REVOKE ALL ON public.scout_requests,public.scout_request_events,public.scout_payment_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scout_requests,public.scout_request_events,public.scout_payment_receipts TO authenticated;
REVOKE ALL ON public.scout_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.scout_evidence TO authenticated;
REVOKE ALL ON public.scout_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.scout_profiles TO authenticated;
REVOKE ALL ON public.scout_price_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scout_price_catalog TO anon,authenticated;
GRANT UPDATE(amount_kes,label,description,active) ON public.scout_price_catalog TO authenticated;
REVOKE ALL ON public.scout_service_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.scout_service_settings TO authenticated;
GRANT UPDATE(payment_instructions,payments_enabled,updated_at) ON public.scout_service_settings TO authenticated;
