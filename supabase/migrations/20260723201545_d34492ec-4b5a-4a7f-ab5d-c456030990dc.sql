
-- Enums
CREATE TYPE public.property_kind AS ENUM ('land','house','apartment','rental','commercial','industrial','agricultural','mixed_use','other');
CREATE TYPE public.property_status AS ENUM ('draft','published','sold','rented','archived');
CREATE TYPE public.listing_intent AS ENUM ('sale','rent','lease');
CREATE TYPE public.lead_stage AS ENUM ('new','contacted','viewing','negotiation','offer','closed','lost');

-- properties
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.property_kind NOT NULL,
  intent public.listing_intent NOT NULL DEFAULT 'sale',
  status public.property_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  price numeric(14,2),
  currency text NOT NULL DEFAULT 'KES',
  size_value numeric(12,2),
  size_unit text DEFAULT 'acres',
  bedrooms int,
  bathrooms int,
  county text,
  address text,
  latitude double precision,
  longitude double precision,
  amenities text[] NOT NULL DEFAULT '{}',
  utilities text[] NOT NULL DEFAULT '{}',
  cover_image text,
  ai_score jsonb,
  ai_summary jsonb,
  featured boolean NOT NULL DEFAULT false,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_status_idx ON public.properties(status);
CREATE INDEX properties_kind_idx ON public.properties(kind);
CREATE INDEX properties_county_idx ON public.properties(county);
CREATE INDEX properties_owner_idx ON public.properties(owner_id);

GRANT SELECT ON public.properties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published properties are readable by anyone"
  ON public.properties FOR SELECT
  USING (status = 'published' OR auth.uid() = owner_id);

CREATE POLICY "Owners insert their own properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their own properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their own properties"
  ON public.properties FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- property_media
CREATE TABLE public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_media_property_idx ON public.property_media(property_id);

GRANT SELECT ON public.property_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media TO authenticated;
GRANT ALL ON public.property_media TO service_role;

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media readable when parent listing is readable"
  ON public.property_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_media.property_id
      AND (p.status = 'published' OR p.owner_id = auth.uid())
  ));

CREATE POLICY "Owners manage their own media"
  ON public.property_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.owner_id = auth.uid()));

-- leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage public.lead_stage NOT NULL DEFAULT 'new',
  message text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_property_idx ON public.leads(property_id);
CREATE INDEX leads_seller_idx ON public.leads(seller_id);
CREATE INDEX leads_buyer_idx ON public.leads(buyer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer or seller can read the lead"
  ON public.leads FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Authenticated buyers create leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Seller updates lead stage"
  ON public.leads FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- viewings
CREATE TABLE public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX viewings_property_idx ON public.viewings(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;

ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer or seller can read viewing"
  ON public.viewings FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers create viewings"
  ON public.viewings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Seller or buyer updates viewing"
  ON public.viewings FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TRIGGER viewings_set_updated_at
  BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- saved_searches
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  query jsonb NOT NULL,
  alerts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_searches_user_idx ON public.saved_searches(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved searches"
  ON public.saved_searches FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER saved_searches_set_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
