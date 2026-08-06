-- 1. Insurance briefs: owner-only read
DROP POLICY IF EXISTS "Signed-in users can read insurance briefs" ON public.insurance_briefs;
CREATE POLICY "Property owner can read insurance brief"
ON public.insurance_briefs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = insurance_briefs.property_id AND p.owner_id = auth.uid()));

-- 2. Profiles: own-row read only
DROP POLICY IF EXISTS "profiles are viewable" ON public.profiles;
CREATE POLICY "users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);
REVOKE SELECT ON public.profiles FROM anon;

-- 3. Professional reviews: public view without reviewer identity
DROP POLICY IF EXISTS "reviews are public" ON public.professional_reviews;
CREATE POLICY "users read own review"
ON public.professional_reviews FOR SELECT TO authenticated
USING (auth.uid() = reviewer_id);

CREATE OR REPLACE VIEW public.professional_reviews_public
WITH (security_invoker = off) AS
  SELECT id, professional_id, rating, comment, created_at, updated_at
  FROM public.professional_reviews;

GRANT SELECT ON public.professional_reviews_public TO anon, authenticated;
GRANT ALL ON public.professional_reviews_public TO service_role;

-- 4. Listing media storage: owner or published-listing owner only
DROP POLICY IF EXISTS "Listing media readable" ON storage.objects;
CREATE POLICY "Listing media readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'listing-media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.owner_id::text = (storage.foldername(name))[1]
        AND p.status = 'published'
    )
  )
);