
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS completeness_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.rental_details (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  monthly_rent numeric,
  deposit numeric,
  service_charge numeric,
  currency text NOT NULL DEFAULT 'KES',
  available_from date,
  bedrooms integer,
  bathrooms integer,
  furnishing text,
  parking_spaces integer,
  utilities_included text[] NOT NULL DEFAULT '{}'::text[],
  security_features text[] NOT NULL DEFAULT '{}'::text[],
  accessibility_features text[] NOT NULL DEFAULT '{}'::text[],
  public_transport text,
  house_rules text,
  contact_name text,
  contact_phone text,
  contact_email text,
  viewing_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rental_details TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_details TO authenticated;
GRANT ALL ON public.rental_details TO service_role;
ALTER TABLE public.rental_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rental details readable when listing readable"
ON public.rental_details FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.properties p
  WHERE p.id = rental_details.property_id
    AND (p.status = 'published' OR p.owner_id = auth.uid())));

CREATE POLICY "Owners manage their rental details"
ON public.rental_details FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = rental_details.property_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = rental_details.property_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_rental_details_updated_at BEFORE UPDATE ON public.rental_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.renter_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  personalization_enabled boolean NOT NULL DEFAULT false,
  budget_min numeric,
  budget_max numeric,
  counties text[] NOT NULL DEFAULT '{}'::text[],
  towns text[] NOT NULL DEFAULT '{}'::text[],
  bedrooms_min integer,
  commute_preference text,
  schools_priority integer NOT NULL DEFAULT 0,
  security_priority integer NOT NULL DEFAULT 0,
  accessibility_needed boolean NOT NULL DEFAULT false,
  amenities text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renter_preferences TO authenticated;
GRANT ALL ON public.renter_preferences TO service_role;
ALTER TABLE public.renter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own renter preferences"
ON public.renter_preferences FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_renter_preferences_updated_at BEFORE UPDATE ON public.renter_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.listing_save_count(p_property_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.properties p WHERE p.id = p_property_id AND p.owner_id = auth.uid())
    THEN (SELECT count(*)::int FROM public.saved_items s WHERE s.kind = 'property' AND s.ref = p_property_id::text)
    ELSE 0
  END;
$$;

GRANT EXECUTE ON FUNCTION public.listing_save_count(uuid) TO authenticated;
