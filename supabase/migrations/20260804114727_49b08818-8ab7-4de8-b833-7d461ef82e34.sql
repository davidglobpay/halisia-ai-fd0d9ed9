CREATE TABLE public.report_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_collections TO authenticated;
GRANT ALL ON public.report_collections TO service_role;
ALTER TABLE public.report_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collections" ON public.report_collections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_report_collections_updated_at BEFORE UPDATE ON public.report_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.report_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.report_collections(id) ON DELETE CASCADE,
  saved_item_id uuid NOT NULL REFERENCES public.saved_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, saved_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_collection_items TO authenticated;
GRANT ALL ON public.report_collection_items TO service_role;
ALTER TABLE public.report_collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collection items" ON public.report_collection_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_item_id uuid NOT NULL REFERENCES public.saved_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  recipient_email text NOT NULL,
  label text NOT NULL,
  latitude double precision,
  longitude double precision,
  deed_ref text,
  note text,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_shares TO authenticated;
GRANT ALL ON public.report_shares TO service_role;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages shares" ON public.report_shares FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "recipient reads active share" ON public.report_shares FOR SELECT TO authenticated
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND lower(recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
CREATE TRIGGER trg_report_shares_updated_at BEFORE UPDATE ON public.report_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_item_id uuid NOT NULL REFERENCES public.saved_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (saved_item_id, version)
);
GRANT SELECT, INSERT ON public.report_versions TO authenticated;
GRANT ALL ON public.report_versions TO service_role;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads versions" ON public.report_versions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "owner writes versions" ON public.report_versions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "share recipient reads versions" ON public.report_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.report_shares s
    WHERE s.saved_item_id = report_versions.saved_item_id
      AND s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND lower(s.recipient_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  ));