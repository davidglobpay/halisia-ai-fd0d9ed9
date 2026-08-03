-- 1. Listing version history
CREATE TABLE public.listing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness_pct integer NOT NULL DEFAULT 0,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_versions_property_idx ON public.listing_versions(property_id, created_at DESC);
GRANT SELECT, INSERT ON public.listing_versions TO authenticated;
GRANT ALL ON public.listing_versions TO service_role;
ALTER TABLE public.listing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their listing versions" ON public.listing_versions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners insert their listing versions" ON public.listing_versions
  FOR INSERT TO authenticated
  WITH CHECK (editor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

-- 2. Secure document vault
CREATE TABLE public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  financing_application_id uuid REFERENCES public.financing_applications(id) ON DELETE SET NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  status text NOT NULL DEFAULT 'required',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vault_documents_owner_idx ON public.vault_documents(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_documents TO authenticated;
GRANT ALL ON public.vault_documents TO service_role;
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their vault documents" ON public.vault_documents
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_vault_documents_updated_at BEFORE UPDATE ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Document shares
CREATE TABLE public.vault_document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.vault_documents(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_name text NOT NULL,
  party_email text NOT NULL,
  organisation text,
  purpose text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vault_document_shares_doc_idx ON public.vault_document_shares(document_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_document_shares TO authenticated;
GRANT ALL ON public.vault_document_shares TO service_role;
ALTER TABLE public.vault_document_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their document shares" ON public.vault_document_shares
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.vault_documents d WHERE d.id = document_id AND d.owner_id = auth.uid()));
CREATE TRIGGER trg_vault_document_shares_updated_at BEFORE UPDATE ON public.vault_document_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Viewing slots (booking workflow)
CREATE TABLE public.viewing_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  note text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX viewing_slots_property_idx ON public.viewing_slots(property_id, start_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewing_slots TO authenticated;
GRANT ALL ON public.viewing_slots TO service_role;
ALTER TABLE public.viewing_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read slots for published listings" ON public.viewing_slots
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.status = 'published'));
CREATE POLICY "Owners insert their slots" ON public.viewing_slots
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update their slots" ON public.viewing_slots
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete their slots" ON public.viewing_slots
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE TRIGGER trg_viewing_slots_updated_at BEFORE UPDATE ON public.viewing_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.viewings ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.viewing_slots(id) ON DELETE SET NULL;