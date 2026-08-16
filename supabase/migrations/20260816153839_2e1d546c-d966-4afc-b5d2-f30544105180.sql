create or replace function public.pulse_provider_status()
returns table (
  provider text,
  status text,
  last_ok_at timestamptz,
  last_error_at timestamptz,
  latency_ms integer,
  requests_today integer
)
language sql
stable
security definer
set search_path = public
as $$
  select h.provider::text,
         h.status::text,
         h.last_ok_at,
         h.last_error_at,
         h.latency_ms,
         h.requests_today
  from public.news_provider_health h
$$;

grant execute on function public.pulse_provider_status() to anon, authenticated, service_role;