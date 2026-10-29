-- Access tests for migration 20261029190000 (projects, members, project links,
-- evidence read policies). Run AFTER the migration, inside a transaction that
-- is always rolled back: the final statement raises with the results, so
-- nothing persists. Every check that fails is listed; "ALL PASS" otherwise.
--
-- Users are created inside the transaction and vanish on rollback.
do $test$
declare
  u1 uuid := '00000000-0000-4000-a000-0000000000a1'; -- owner
  u2 uuid := '00000000-0000-4000-a000-0000000000a2'; -- stranger
  u3 uuid := '00000000-0000-4000-a000-0000000000a3'; -- viewer member
  u4 uuid := '00000000-0000-4000-a000-0000000000a4'; -- editor member
  p uuid;
  par uuid;
  src uuid;
  n int;
  failures text[] := '{}';
  passes int := 0;
  procedure_ok boolean;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
  values (u1, 'owner@test.invalid', 'authenticated', 'authenticated', now(), now(), now()),
         (u2, 'stranger@test.invalid', 'authenticated', 'authenticated', now(), now(), now()),
         (u3, 'viewer@test.invalid', 'authenticated', 'authenticated', now(), now(), now()),
         (u4, 'editor@test.invalid', 'authenticated', 'authenticated', now(), now(), now());
  select id into src from public.resource_sources where source_system = 'google_elevation';

  -- helper: act as a user
  -- (set_config with is_local=true lasts until the transaction ends)

  -- 1. owner creates a project
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.projects (name, latitude, longitude, location_key)
  values ('Test site', -1.2921, 36.8219, 'geo:-1.2921,36.8219') returning id into p;
  if p is not null then passes := passes + 1; else failures := failures || 'owner create'; end if;

  insert into public.project_members (project_id, user_id, role) values (p, u3, 'viewer'), (p, u4, 'editor');
  passes := passes + 1;

  insert into public.parcels (owner_id, title_deed_no, parcel_code, county, centroid_lat, centroid_lng, area_sqm, geometry)
  values (u1, 'TEST/ACCESS/1', 'TEST-ACCESS-1', 'Nairobi', -1.2921, 36.8219, 500,
          '{"type":"Polygon","coordinates":[[[36.8218,-1.2920],[36.8220,-1.2920],[36.8220,-1.2922],[36.8218,-1.2922],[36.8218,-1.2920]]]}'::jsonb)
  returning id into par;

  -- 2. stranger cannot see it
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  select count(*) into n from public.projects where id = p;
  if n = 0 then passes := passes + 1; else failures := failures || 'stranger reads project'; end if;
  select count(*) into n from public.project_members where project_id = p;
  if n = 0 then passes := passes + 1; else failures := failures || 'stranger reads members'; end if;

  -- 3. stranger cannot add themselves as a member
  procedure_ok := false;
  begin
    insert into public.project_members (project_id, user_id, role) values (p, u2, 'editor');
  exception when others then procedure_ok := true;
  end;
  if procedure_ok then passes := passes + 1; else failures := failures || 'stranger self-adds'; end if;

  -- 4. stranger cannot create a project owned by someone else
  procedure_ok := false;
  begin
    insert into public.projects (owner_id, name) values (u1, 'Hijack');
  exception when others then procedure_ok := true;
  end;
  if procedure_ok then passes := passes + 1; else failures := failures || 'stranger creates for owner'; end if;

  -- 5. stranger cannot link their own saved item to the project
  procedure_ok := false;
  begin
    insert into public.saved_items (user_id, kind, ref, label, project_id)
    values (u2, 'location', 'geo:x', 'Mine', p);
  exception when others then procedure_ok := true;
  end;
  if procedure_ok then passes := passes + 1; else failures := failures || 'stranger links item'; end if;

  -- 6. stranger cannot edit the project
  update public.projects set name = 'Changed by stranger' where id = p;
  get diagnostics n = row_count;
  if n = 0 then passes := passes + 1; else failures := failures || 'stranger edits project'; end if;

  -- 7. viewer reads but cannot edit or link
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u3::text, true);
  select count(*) into n from public.projects where id = p;
  if n = 1 then passes := passes + 1; else failures := failures || 'viewer cannot read'; end if;
  update public.projects set name = 'Changed by viewer' where id = p;
  get diagnostics n = row_count;
  if n = 0 then passes := passes + 1; else failures := failures || 'viewer edits project'; end if;
  procedure_ok := false;
  begin
    insert into public.saved_items (user_id, kind, ref, label, project_id)
    values (u3, 'location', 'geo:y', 'Viewer item', p);
  exception when others then procedure_ok := true;
  end;
  if procedure_ok then passes := passes + 1; else failures := failures || 'viewer links item'; end if;

  -- 8. editor edits and links, but cannot take ownership
  perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u4::text, true);
  update public.projects set name = 'Renamed by editor', stage = 'design' where id = p;
  get diagnostics n = row_count;
  if n = 1 then passes := passes + 1; else failures := failures || 'editor cannot edit'; end if;
  procedure_ok := true;
  begin
    insert into public.saved_items (user_id, kind, ref, label, project_id)
    values (u4, 'location', 'geo:z', 'Editor item', p);
  exception when others then
    procedure_ok := false;
    failures := failures || ('editor cannot link: ' || sqlerrm);
  end;
  if procedure_ok then passes := passes + 1; end if;
  procedure_ok := false;
  begin
    update public.projects set owner_id = u4 where id = p;
  exception when others then procedure_ok := true;
  end;
  if procedure_ok then passes := passes + 1; else failures := failures || 'editor takes ownership'; end if;

  -- 9. observations: area readable by anyone signed in, parcel only by its owner
  perform set_config('role', 'none', true);
  insert into public.resource_observations
    (subject_type, subject_ref, domain, indicator, value_json, source_id, source_record_id, methodology, epistemic_tier, provenance_hash)
  values
    ('area', 'geo:-1.2921,36.8219', 'LAND', 'elevation', '{"m":1661}', src, 'geo:-1.2921,36.8219', 'test', 'OBSERVED_THIRD_PARTY', 'h1');
  insert into public.resource_observations
    (subject_type, subject_ref, parcel_id, domain, indicator, value_json, source_id, source_record_id, methodology, epistemic_tier, provenance_hash)
  values
    ('parcel', 'parcel:' || par, par, 'LAND', 'elevation', '{"m":1661}', src, 'parcel:' || par, 'test', 'OBSERVED_THIRD_PARTY', 'h2');
  perform set_config('role', 'authenticated', true);

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u2::text, true);
  select count(*) into n from public.resource_observations where subject_ref = 'geo:-1.2921,36.8219';
  if n >= 1 then passes := passes + 1; else failures := failures || 'stranger cannot read area evidence'; end if;
  select count(*) into n from public.resource_observations where parcel_id = par;
  if n = 0 then passes := passes + 1; else failures := failures || 'stranger reads parcel evidence'; end if;
  select count(*) into n from public.resource_sources where source_system = 'google_elevation';
  if n = 1 then passes := passes + 1; else failures := failures || 'cannot read sources'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u1::text, true);
  select count(*) into n from public.resource_observations where parcel_id = par;
  if n = 1 then passes := passes + 1; else failures := failures || 'owner cannot read parcel evidence'; end if;

  -- 10. a member can leave; the owner still sees the project
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u3::text, true);
  delete from public.project_members where project_id = p and user_id = u3;
  get diagnostics n = row_count;
  if n = 1 then passes := passes + 1; else failures := failures || 'member cannot leave'; end if;
  select count(*) into n from public.projects where id = p;
  if n = 0 then passes := passes + 1; else failures := failures || 'former member still reads'; end if;

  perform set_config('role', 'none', true);
  raise exception 'PROJECT ACCESS TESTS: % passed, % failed%', passes, coalesce(array_length(failures, 1), 0),
    case when array_length(failures, 1) is null then ' (ALL PASS)' else ': ' || array_to_string(failures, '; ') end;
end
$test$;
