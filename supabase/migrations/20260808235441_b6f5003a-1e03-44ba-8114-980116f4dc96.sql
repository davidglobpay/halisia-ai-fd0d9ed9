-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.news_provider AS ENUM ('newsdata','gnews','gdelt','rss');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.news_provider_status AS ENUM ('active','degraded','disabled','awaiting_api_key');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.news_geo_level AS ENUM ('national','county','sub_county','town','estate','neighbourhood');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ SOURCES ============
CREATE TABLE IF NOT EXISTS public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  provider public.news_provider NOT NULL,
  feed_url text,
  homepage_url text,
  logo_url text,
  county text,
  category_hint text,
  status public.news_provider_status NOT NULL DEFAULT 'active',
  refresh_minutes integer NOT NULL DEFAULT 10,
  last_fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_sources TO anon, authenticated;
GRANT ALL ON public.news_sources TO service_role;
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_sources_public_read" ON public.news_sources FOR SELECT USING (true);
CREATE POLICY "news_sources_admin_write" ON public.news_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.news_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_categories TO anon, authenticated;
GRANT ALL ON public.news_categories TO service_role;
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_categories_public_read" ON public.news_categories FOR SELECT USING (true);
CREATE POLICY "news_categories_admin_write" ON public.news_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ ARTICLES ============
CREATE TABLE IF NOT EXISTS public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  provider public.news_provider NOT NULL,
  external_id text,
  url text NOT NULL,
  url_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  title_normalized text NOT NULL,
  author text,
  source_name text,
  source_logo_url text,
  image_url text,
  language text NOT NULL DEFAULT 'en',
  raw_excerpt text,
  summary text,
  why_it_matters text,
  property_impact text,
  land_impact text,
  infrastructure_impact text,
  investment_impact text,
  environmental_impact text,
  category text NOT NULL DEFAULT 'business',
  tags text[] NOT NULL DEFAULT '{}',
  county text,
  geo_level public.news_geo_level NOT NULL DEFAULT 'national',
  place_label text,
  latitude double precision,
  longitude double precision,
  confidence integer NOT NULL DEFAULT 50,
  ai_processed boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  share_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_articles_published_idx ON public.news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS news_articles_county_idx ON public.news_articles (county);
CREATE INDEX IF NOT EXISTS news_articles_category_idx ON public.news_articles (category);
CREATE INDEX IF NOT EXISTS news_articles_title_norm_idx ON public.news_articles (title_normalized);
GRANT SELECT ON public.news_articles TO anon, authenticated;
GRANT ALL ON public.news_articles TO service_role;
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_articles_public_read" ON public.news_articles FOR SELECT USING (archived = false);
CREATE POLICY "news_articles_admin_write" ON public.news_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ LOCATIONS ============
CREATE TABLE IF NOT EXISTS public.news_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  label text NOT NULL,
  geo_level public.news_geo_level NOT NULL DEFAULT 'county',
  county text,
  latitude double precision,
  longitude double precision,
  confidence integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_locations_article_idx ON public.news_locations (article_id);
GRANT SELECT ON public.news_locations TO anon, authenticated;
GRANT ALL ON public.news_locations TO service_role;
ALTER TABLE public.news_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_locations_public_read" ON public.news_locations FOR SELECT USING (true);
CREATE POLICY "news_locations_admin_write" ON public.news_locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ CLUSTERS ============
CREATE TABLE IF NOT EXISTS public.news_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  county text,
  category text,
  article_count integer NOT NULL DEFAULT 1,
  source_count integer NOT NULL DEFAULT 1,
  last_article_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_clusters TO anon, authenticated;
GRANT ALL ON public.news_clusters TO service_role;
ALTER TABLE public.news_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_clusters_public_read" ON public.news_clusters FOR SELECT USING (true);
CREATE POLICY "news_clusters_admin_write" ON public.news_clusters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

ALTER TABLE public.news_articles ADD COLUMN IF NOT EXISTS cluster_id uuid REFERENCES public.news_clusters(id) ON DELETE SET NULL;

-- ============ ARTICLE MEDIA ============
CREATE TABLE IF NOT EXISTS public.article_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_media_article_idx ON public.article_media (article_id);
GRANT SELECT ON public.article_media TO anon, authenticated;
GRANT ALL ON public.article_media TO service_role;
ALTER TABLE public.article_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "article_media_public_read" ON public.article_media FOR SELECT USING (true);
CREATE POLICY "article_media_admin_write" ON public.article_media FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ AUDIO ============
CREATE TABLE IF NOT EXISTS public.news_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  segment text NOT NULL DEFAULT 'summary',
  engine text NOT NULL DEFAULT 'web_speech',
  voice text,
  script text NOT NULL,
  audio_url text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, segment, engine)
);
GRANT SELECT ON public.news_audio TO anon, authenticated;
GRANT ALL ON public.news_audio TO service_role;
ALTER TABLE public.news_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_audio_public_read" ON public.news_audio FOR SELECT USING (true);
CREATE POLICY "news_audio_admin_write" ON public.news_audio FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ SAVED ARTICLES ============
CREATE TABLE IF NOT EXISTS public.saved_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_articles TO authenticated;
GRANT ALL ON public.saved_articles TO service_role;
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_articles_own" ON public.saved_articles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ TAGS ============
CREATE TABLE IF NOT EXISTS public.news_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_tags TO anon, authenticated;
GRANT ALL ON public.news_tags TO service_role;
ALTER TABLE public.news_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_tags_public_read" ON public.news_tags FOR SELECT USING (true);
CREATE POLICY "news_tags_admin_write" ON public.news_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ TRENDING ============
CREATE TABLE IF NOT EXISTS public.trending_scores (
  article_id uuid PRIMARY KEY REFERENCES public.news_articles(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  freshness numeric NOT NULL DEFAULT 0,
  source_spread numeric NOT NULL DEFAULT 0,
  engagement numeric NOT NULL DEFAULT 0,
  ai_importance numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trending_scores TO anon, authenticated;
GRANT ALL ON public.trending_scores TO service_role;
ALTER TABLE public.trending_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trending_scores_public_read" ON public.trending_scores FOR SELECT USING (true);
CREATE POLICY "trending_scores_admin_write" ON public.trending_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ INGESTION LOGS ============
CREATE TABLE IF NOT EXISTS public.news_ingestion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.news_provider NOT NULL,
  source_id uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_ingestion_logs_started_idx ON public.news_ingestion_logs (started_at DESC);
GRANT SELECT ON public.news_ingestion_logs TO authenticated;
GRANT ALL ON public.news_ingestion_logs TO service_role;
ALTER TABLE public.news_ingestion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_ingestion_logs_admin_read" ON public.news_ingestion_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- ============ PROVIDER HEALTH ============
CREATE TABLE IF NOT EXISTS public.news_provider_health (
  provider public.news_provider PRIMARY KEY,
  status public.news_provider_status NOT NULL DEFAULT 'active',
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  latency_ms integer,
  requests_today integer NOT NULL DEFAULT 0,
  quota_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_provider_health TO authenticated;
GRANT ALL ON public.news_provider_health TO service_role;
ALTER TABLE public.news_provider_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_provider_health_admin_read" ON public.news_provider_health FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_news_sources_updated_at BEFORE UPDATE ON public.news_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_news_articles_updated_at BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_news_clusters_updated_at BEFORE UPDATE ON public.news_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_news_tags_updated_at BEFORE UPDATE ON public.news_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED: CATEGORIES ============
INSERT INTO public.news_categories (slug, label, position) VALUES
  ('politics','Politics',1),('infrastructure','Infrastructure',2),('roads','Roads',3),
  ('transport','Transport',4),('housing','Housing',5),('land','Land',6),
  ('property','Property',7),('environment','Environment',8),('climate','Climate',9),
  ('flooding','Flooding',10),('agriculture','Agriculture',11),('business','Business',12),
  ('technology','Technology',13),('health','Health',14),('education','Education',15),
  ('security','Security',16),('investment','Investment',17),('energy','Energy',18),
  ('utilities','Utilities',19),('tourism','Tourism',20),('county-government','County Government',21)
ON CONFLICT (slug) DO NOTHING;

-- ============ SEED: RSS SOURCES ============
INSERT INTO public.news_sources (slug, name, provider, feed_url, homepage_url, category_hint) VALUES
  ('daily-nation','Daily Nation','rss','https://nation.africa/kenya/rss','https://nation.africa','politics'),
  ('business-daily','Business Daily Africa','rss','https://www.businessdailyafrica.com/bd/rss','https://www.businessdailyafrica.com','business'),
  ('the-star','The Star Kenya','rss','https://www.the-star.co.ke/rss/','https://www.the-star.co.ke','politics'),
  ('citizen-digital','Citizen Digital','rss','https://citizen.digital/feed','https://citizen.digital','politics'),
  ('capital-fm','Capital FM','rss','https://www.capitalfm.co.ke/news/feed/','https://www.capitalfm.co.ke','business'),
  ('gov-press','Government Press Releases','rss','https://www.president.go.ke/feed/','https://www.president.go.ke','county-government'),
  ('knbs','Kenya National Bureau of Statistics','rss','https://www.knbs.or.ke/feed/','https://www.knbs.or.ke','business'),
  ('nema','NEMA Kenya','rss','https://www.nema.go.ke/index.php?format=feed&type=rss','https://www.nema.go.ke','environment'),
  ('kenha','KeNHA','rss','https://kenha.co.ke/feed/','https://kenha.co.ke','roads'),
  ('kura','KURA','rss','https://www.kura.go.ke/feed/','https://www.kura.go.ke','roads'),
  ('ministry-lands','Ministry of Lands','rss','https://lands.go.ke/feed/','https://lands.go.ke','land'),
  ('kenya-met','Kenya Meteorological Department','rss','https://meteo.go.ke/feed','https://meteo.go.ke','climate'),
  ('county-govs','County Government Updates','rss','https://www.cog.go.ke/feed','https://www.cog.go.ke','county-government'),
  ('newsdata','NewsData.io','newsdata',NULL,'https://newsdata.io',NULL),
  ('gnews','GNews','gnews',NULL,'https://gnews.io',NULL),
  ('gdelt','GDELT Project','gdelt',NULL,'https://www.gdeltproject.org',NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.news_provider_health (provider, status) VALUES
  ('newsdata','active'),('gnews','active'),('gdelt','active'),('rss','active')
ON CONFLICT (provider) DO NOTHING;