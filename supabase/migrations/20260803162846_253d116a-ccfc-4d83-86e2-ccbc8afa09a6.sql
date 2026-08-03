
CREATE POLICY "Listing media readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'listing-media');

CREATE POLICY "Users upload own listing media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own listing media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own listing media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing-media' AND (storage.foldername(name))[1] = auth.uid()::text);
