CREATE POLICY "Vault owners read own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-vault' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Vault owners upload own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance-vault' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Vault owners update own files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'finance-vault' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'finance-vault' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Vault owners delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance-vault' AND (storage.foldername(name))[1] = auth.uid()::text);