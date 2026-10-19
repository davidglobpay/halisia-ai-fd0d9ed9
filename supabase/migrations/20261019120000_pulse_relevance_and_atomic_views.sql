-- Additive rollout: deploy this before the application. No article deletion.
BEGIN;
ALTER TABLE public.news_ingestion_logs ADD COLUMN IF NOT EXISTS rejected_count integer NOT NULL DEFAULT 0 CHECK(rejected_count>=0);
CREATE OR REPLACE FUNCTION public.increment_article_view(_article_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE public.news_articles SET view_count=LEAST(coalesce(view_count,0)::bigint+1,2147483647)::integer WHERE id=_article_id AND archived=false;
$$;
REVOKE ALL ON FUNCTION public.increment_article_view(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.increment_article_view(uuid) TO service_role;
CREATE SCHEMA IF NOT EXISTS halisia_private;
CREATE TABLE IF NOT EXISTS halisia_private.pulse_archive_audit(
 run_id text NOT NULL, article_id uuid NOT NULL REFERENCES public.news_articles(id),
 previous_archived boolean NOT NULL, content_hash text NOT NULL,
 archived_at timestamptz NOT NULL DEFAULT now(), restored_at timestamptz,
 PRIMARY KEY(run_id,article_id)
);
ALTER TABLE halisia_private.pulse_archive_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON halisia_private.pulse_archive_audit FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
