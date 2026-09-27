DROP POLICY IF EXISTS "parcels public read" ON public.parcels;
DROP POLICY IF EXISTS "beacons public read" ON public.parcel_beacons;

CREATE POLICY "parcels owner admin surveyor read"
ON public.parcels
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR public.has_role(auth.uid(), 'administrator'::public.app_role)
  OR public.is_verified_surveyor(auth.uid())
);

CREATE POLICY "beacons owner admin surveyor read"
ON public.parcel_beacons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = parcel_beacons.parcel_id
      AND (
        p.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrator'::public.app_role)
        OR public.is_verified_surveyor(auth.uid())
      )
  )
);