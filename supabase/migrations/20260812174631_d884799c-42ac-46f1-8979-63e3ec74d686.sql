UPDATE public.news_sources SET feed_url = 'https://nation.africa/kenya/rss.xml', status = 'active' WHERE feed_url = 'https://nation.africa/kenya/rss';

UPDATE public.news_sources SET status = 'disabled'
WHERE feed_url IN (
  'https://www.businessdailyafrica.com/bd/rss',
  'https://www.the-star.co.ke/rss/',
  'https://citizen.digital/feed',
  'https://www.knbs.or.ke/feed/',
  'https://kenha.co.ke/feed/',
  'https://www.kura.go.ke/feed/',
  'https://lands.go.ke/feed/',
  'https://meteo.go.ke/feed'
);

INSERT INTO public.news_sources (slug, name, provider, feed_url, category_hint, status)
VALUES
  ('standard-headlines', 'The Standard', 'rss', 'https://www.standardmedia.co.ke/rss/headlines.php', NULL, 'active'),
  ('kbc-news', 'KBC', 'rss', 'https://www.kbc.co.ke/feed/', NULL, 'active'),
  ('tuko-news', 'Tuko', 'rss', 'https://www.tuko.co.ke/rss/all.rss', NULL, 'active'),
  ('gnews-land-property', 'Google News — Kenya Land & Property', 'rss', 'https://news.google.com/rss/search?q=Kenya+land+OR+property+OR+housing&hl=en-KE&gl=KE&ceid=KE:en', 'property', 'active'),
  ('gnews-infrastructure', 'Google News — Kenya Infrastructure', 'rss', 'https://news.google.com/rss/search?q=Kenya+county+infrastructure+OR+roads+OR+investment&hl=en-KE&gl=KE&ceid=KE:en', 'infrastructure', 'active')
ON CONFLICT (slug) DO UPDATE SET feed_url = EXCLUDED.feed_url, status = 'active';