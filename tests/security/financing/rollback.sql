BEGIN;
CREATE OR REPLACE FUNCTION halisia_private.guard_financing_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid := auth.uid();
begin
  -- A null caller means row-level security was bypassed: a service-role or
  -- other server-side connection. An ordinary user cannot reach this trigger
  -- with a null uid, because the applicant policy requires
  -- auth.uid() = applicant_id, which fails when uid is null.
  if caller is null then
    return new;
  end if;

  -- The applicant keeps draft, submitted and withdrawn. Every status that
  -- represents a lender decision is an administrator transition.
  if new.status is distinct from old.status
     and new.status in ('under_review','approved','funded','rejected')
     and not has_role(caller, 'administrator'::app_role)
  then
    raise exception
      'financing status % may only be set by an administrator or an authorised backend process',
      new.status
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
DROP TRIGGER halisia_guard_financing_status ON public.financing_applications;
CREATE TRIGGER halisia_guard_financing_status BEFORE UPDATE ON public.financing_applications FOR EACH ROW EXECUTE FUNCTION halisia_private.guard_financing_status();
GRANT TRUNCATE, TRIGGER, REFERENCES ON public.financing_applications TO anon, authenticated;
COMMIT;
