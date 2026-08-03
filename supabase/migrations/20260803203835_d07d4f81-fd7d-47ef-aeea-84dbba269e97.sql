-- 1. Roles ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'explorer','buyer','tenant','landowner','seller','land_agent','property_company',
  'landlord','developer','investor','architect','engineer','surveyor','valuer',
  'contractor','lawyer','financial_institution','government_partner','contributor','administrator'
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "add own roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role <> 'administrator');
CREATE POLICY "remove own roles" ON public.user_roles FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND role <> 'administrator');

-- 2. Profiles -------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  headline text,
  county text,
  phone text,
  avatar_url text,
  news_topics text[] NOT NULL DEFAULT '{}',
  alert_email boolean NOT NULL DEFAULT true,
  alert_in_app boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles are viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'explorer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Professional directory ----------------------------------------------
CREATE TYPE public.pro_category AS ENUM (
  'architect','engineer','surveyor','planner','valuer','lawyer','contractor',
  'interior_designer','landscape_designer','quantity_surveyor','environmental_consultant',
  'property_manager','real_estate_agent','financial_adviser','bank','insurance_provider','utility_provider'
);
CREATE TYPE public.pro_verification AS ENUM ('unverified','pending','verified');

CREATE TABLE public.professional_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  organisation text,
  category public.pro_category NOT NULL,
  bio text,
  county text,
  town text,
  service_counties text[] NOT NULL DEFAULT '{}',
  years_experience integer,
  qualifications text[] NOT NULL DEFAULT '{}',
  registration_body text,
  registration_number text,
  verification_status public.pro_verification NOT NULL DEFAULT 'unverified',
  verified_at timestamptz,
  portfolio jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability text,
  rate_note text,
  contact_email text,
  contact_phone text,
  website text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_profiles TO authenticated;
GRANT SELECT ON public.professional_profiles TO anon;
GRANT ALL ON public.professional_profiles TO service_role;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published pros are public" ON public.professional_profiles FOR SELECT USING (published = true);
CREATE POLICY "owners read own pro profile" ON public.professional_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "owners create pro profile" ON public.professional_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND verification_status = 'unverified');
CREATE POLICY "owners update pro profile" ON public.professional_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update pro profile" ON public.professional_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "owners delete pro profile" ON public.professional_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_pro_profiles_updated_at BEFORE UPDATE ON public.professional_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.professional_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professional_id, reviewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_reviews TO authenticated;
GRANT SELECT ON public.professional_reviews TO anon;
GRANT ALL ON public.professional_reviews TO service_role;
ALTER TABLE public.professional_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews are public" ON public.professional_reviews FOR SELECT USING (true);
CREATE POLICY "write own review" ON public.professional_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "update own review" ON public.professional_reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "delete own review" ON public.professional_reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);
CREATE TRIGGER trg_pro_reviews_updated_at BEFORE UPDATE ON public.professional_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.professional_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  project_brief text NOT NULL,
  county text,
  budget_note text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.professional_requests TO authenticated;
GRANT ALL ON public.professional_requests TO service_role;
ALTER TABLE public.professional_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requester or pro reads request" ON public.professional_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR EXISTS (
    SELECT 1 FROM public.professional_profiles p WHERE p.id = professional_id AND p.user_id = auth.uid()));
CREATE POLICY "create own request" ON public.professional_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "pro updates request status" ON public.professional_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.id = professional_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.id = professional_id AND p.user_id = auth.uid()));
CREATE TRIGGER trg_pro_requests_updated_at BEFORE UPDATE ON public.professional_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Contributions --------------------------------------------------------
CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  ref text,
  county text,
  status text NOT NULL DEFAULT 'pending',
  quality_score integer,
  reward_points integer NOT NULL DEFAULT 0,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contributions TO authenticated;
GRANT ALL ON public.contributions TO service_role;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own contributions" ON public.contributions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrator'));
CREATE POLICY "create own contribution" ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND reward_points = 0);
CREATE POLICY "update own pending contribution" ON public.contributions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins review contributions" ON public.contributions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrator')) WITH CHECK (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();