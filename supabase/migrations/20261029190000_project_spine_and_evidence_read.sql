-- Stage 1 of the next-generation plan: one project record per site, and
-- read access to the evidence graph so the app can show why it says things.
--
-- Additive only. No existing column, policy or row is changed except:
--   * a nullable project_id column on five tables, and
--   * new SELECT policies on resource_observations / resource_sources.
-- Safe to run more than once.

-- ---------------------------------------------------------------- projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  stage text not null default 'land'
    check (stage in ('land','feasibility','design','construction','financing','transaction','occupied','archived')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  -- Same key format as location_intel_slices / resource_observations.subject_ref.
  location_key text,
  county text,
  parcel_id uuid references public.parcels(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  -- GeoJSON Polygon drawn or fitted by the user. Not a surveyed boundary.
  boundary jsonb,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id);
create index if not exists projects_location_key_idx on public.projects(location_key);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer','editor','professional')),
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

-- Owner or member. SECURITY DEFINER so policies on other tables can call it
-- without recursing through project_members' own policies.
create or replace function public.is_project_member(_project_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (select 1 from public.projects p where p.id = _project_id and p.owner_id = auth.uid())
      or exists (select 1 from public.project_members m where m.project_id = _project_id and m.user_id = auth.uid())
$$;

create or replace function public.is_project_editor(_project_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select exists (select 1 from public.projects p where p.id = _project_id and p.owner_id = auth.uid())
      or exists (select 1 from public.project_members m
                 where m.project_id = _project_id and m.user_id = auth.uid() and m.role = 'editor')
$$;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

drop policy if exists halisia_active_account on public.projects;
create policy halisia_active_account on public.projects as restrictive for all to authenticated
  using (public.halisia_account_active()) with check (public.halisia_account_active());
drop policy if exists halisia_active_account on public.project_members;
create policy halisia_active_account on public.project_members as restrictive for all to authenticated
  using (public.halisia_account_active()) with check (public.halisia_account_active());

drop policy if exists "members read projects" on public.projects;
create policy "members read projects" on public.projects for select to authenticated
  using (public.is_project_member(id) or public.has_role(auth.uid(), 'administrator'::public.app_role));
drop policy if exists "owner creates projects" on public.projects;
create policy "owner creates projects" on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists "editors update projects" on public.projects;
create policy "editors update projects" on public.projects for update to authenticated
  using (public.is_project_editor(id)) with check (public.is_project_editor(id));
drop policy if exists "owner deletes projects" on public.projects;
create policy "owner deletes projects" on public.projects for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "members read membership" on public.project_members;
create policy "members read membership" on public.project_members for select to authenticated
  using (public.is_project_member(project_id) or public.has_role(auth.uid(), 'administrator'::public.app_role));
drop policy if exists "owner adds members" on public.project_members;
create policy "owner adds members" on public.project_members for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
drop policy if exists "owner changes member roles" on public.project_members;
create policy "owner changes member roles" on public.project_members for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
drop policy if exists "owner or self removes member" on public.project_members;
create policy "owner or self removes member" on public.project_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- Owners cannot be reassigned by an editor.
create or replace function public.halisia_guard_project_owner()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id
     and not public.has_role(auth.uid(), 'administrator'::public.app_role) then
    raise exception 'project owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists halisia_guard_project_owner on public.projects;
create trigger halisia_guard_project_owner before update on public.projects
  for each row execute function public.halisia_guard_project_owner();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
drop trigger if exists halisia_reject_suspended_write on public.projects;
create trigger halisia_reject_suspended_write before insert or update or delete on public.projects
  for each row execute function halisia_private.reject_suspended_write();
drop trigger if exists halisia_reject_suspended_write on public.project_members;
create trigger halisia_reject_suspended_write before insert or update or delete on public.project_members
  for each row execute function halisia_private.reject_suspended_write();

-- ------------------------------------------------- links from existing records
alter table public.parcels add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.properties add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.financing_applications add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.saved_items add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.bid_requests add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists parcels_project_idx on public.parcels(project_id);
create index if not exists properties_project_idx on public.properties(project_id);
create index if not exists financing_applications_project_idx on public.financing_applications(project_id);
create index if not exists saved_items_project_idx on public.saved_items(project_id);
create index if not exists bid_requests_project_idx on public.bid_requests(project_id);

-- A record may only be attached to a project its author can edit. Existing
-- row policies still decide who may change the record itself.
create or replace function public.halisia_guard_project_link()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.project_id is not null
     and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
     and auth.uid() is not null
     and not public.has_role(auth.uid(), 'administrator'::public.app_role)
     and not public.is_project_editor(new.project_id) then
    raise exception 'you can only link records to a project you can edit' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['parcels','properties','financing_applications','saved_items','bid_requests'] loop
    execute format('drop trigger if exists halisia_guard_project_link on public.%I', t);
    execute format('create trigger halisia_guard_project_link before insert or update of project_id on public.%I
                    for each row execute function public.halisia_guard_project_link()', t);
  end loop;
end $$;

-- ------------------------------------------------ evidence graph: read access
-- Observations about a public place (subject_type 'area') hold third-party
-- context such as elevation, air quality and nearby services: no personal
-- data. Parcel observations stay with the parcel's owner; project
-- observations with the project's members. Admin read already exists.
drop policy if exists "signed-in users read area observations" on public.resource_observations;
create policy "signed-in users read area observations" on public.resource_observations
  for select to authenticated using (subject_type = 'area');

drop policy if exists "parcel owners read parcel observations" on public.resource_observations;
create policy "parcel owners read parcel observations" on public.resource_observations
  for select to authenticated using (
    subject_type = 'parcel' and parcel_id is not null
    and exists (select 1 from public.parcels p where p.id = parcel_id and p.owner_id = auth.uid())
  );

drop policy if exists "project members read project observations" on public.resource_observations;
create policy "project members read project observations" on public.resource_observations
  for select to authenticated using (
    subject_type = 'project'
    -- CASE, not AND: Postgres may evaluate AND operands in any order, and a
    -- non-uuid subject_ref must never reach the cast.
    and case
          when subject_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then public.is_project_member(subject_ref::uuid)
          else false
        end
  );

drop policy if exists "signed-in users read active sources" on public.resource_sources;
create policy "signed-in users read active sources" on public.resource_sources
  for select to authenticated using (active);

create index if not exists resource_observations_subject_idx
  on public.resource_observations(subject_type, subject_ref, retrieved_at desc);
