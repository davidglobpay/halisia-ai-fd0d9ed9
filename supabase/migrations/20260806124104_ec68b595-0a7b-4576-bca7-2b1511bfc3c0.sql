DROP VIEW IF EXISTS public.professional_reviews_public;

-- Reviews stay publicly readable, but reviewer_id is hidden via column-level grants
DROP POLICY IF EXISTS "users read own review" ON public.professional_reviews;
CREATE POLICY "reviews are public"
ON public.professional_reviews FOR SELECT TO anon, authenticated
USING (true);

REVOKE SELECT ON public.professional_reviews FROM anon, authenticated;
GRANT SELECT (id, professional_id, rating, comment, created_at, updated_at)
  ON public.professional_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.professional_reviews TO authenticated;
GRANT ALL ON public.professional_reviews TO service_role;