DROP POLICY IF EXISTS "Authenticated users can read verification history" ON public.parcel_verification_events;
CREATE POLICY "Parcel owners and reviewers read verification history"
ON public.parcel_verification_events FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.parcels p WHERE p.id = parcel_verification_events.parcel_id AND p.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'administrator')
  OR public.is_verified_surveyor(auth.uid())
);

DROP POLICY IF EXISTS "Listing media readable" ON storage.objects;
CREATE POLICY "Listing media readable by owner"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);