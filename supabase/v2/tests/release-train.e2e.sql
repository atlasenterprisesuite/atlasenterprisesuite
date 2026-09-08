begin;

create temp table atlas_release_e2e_scope (
  operator_id uuid not null,
  viewer_id uuid not null,
  candidate_id uuid,
  candidate_sha text not null
) on commit drop;

grant select, update on table atlas_release_e2e_scope to authenticated, service_role;

insert into atlas_release_e2e_scope(operator_id, viewer_id, candidate_sha)
values (gen_random_uuid(), gen_random_uuid(), repeat('a', 40));

insert into auth.users (
  id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,is_sso_user,is_anonymous
)
select operator_id,'authenticated','authenticated',
       'atlas-release-operator-' || substr(replace(operator_id::text,'-',''),1,12) || '@invalid.local',
       '', '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,
       now(),now(),false,false
from atlas_release_e2e_scope
union all
select viewer_id,'authenticated','authenticated',
       'atlas-release-viewer-' || substr(replace(viewer_id::text,'-',''),1,12) || '@invalid.local',
       '', '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,
       now(),now(),false,false
from atlas_release_e2e_scope;

-- Schema, fail-closed defaults, and direct-grant boundaries.
do $$
declare
  active_count integer;
  release_controller_wave integer;
  lock_open boolean;
begin
  if to_regclass('public.atlas_release_state') is null
     or to_regclass('public.atlas_release_modules') is null
     or to_regclass('public.atlas_release_candidates') is null
     or to_regclass('public.atlas_release_queue_items') is null
     or to_regclass('public.atlas_release_evidence') is null
     or to_regclass('public.atlas_release_events') is null then
    raise exception 'release-train schema is incomplete';
  end if;

  select count(*) into active_count
  from public.atlas_release_modules where activation_enabled = true;
  if active_count <> 0 then raise exception 'release catalog must seed fail-closed'; end if;

  select release_wave into release_controller_wave
  from public.atlas_release_modules where module_code = 'release-controller';
  if release_controller_wave <> 0 then raise exception 'release-controller must be wave 0'; end if;

  select is_open into lock_open from public.atlas_release_state where singleton = true;
  if lock_open is distinct from false then raise exception 'global release lock must default closed'; end if;

  if has_table_privilege('authenticated', 'public.atlas_release_modules', 'UPDATE') then
    raise exception 'authenticated must not update release modules directly';
  end if;
  if has_table_privilege('authenticated', 'public.atlas_release_evidence', 'INSERT') then
    raise exception 'authenticated must not insert release evidence directly';
  end if;
  if has_function_privilege('authenticated', 'public.atlas_release_record_evidence(uuid,text,text,text,boolean,jsonb)', 'EXECUTE') then
    raise exception 'release evidence RPC must be service-only';
  end if;
  if has_function_privilege('authenticated', 'public.atlas_release_set_operator(uuid,boolean,text)', 'EXECUTE') then
    raise exception 'operator bootstrap RPC must be service-only';
  end if;
end $$;

-- A non-operator cannot freeze or control a release candidate.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select viewer_id::text from atlas_release_e2e_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select viewer_id::text from atlas_release_e2e_scope),'role','authenticated')::text,true);

do $$
declare blocked boolean := false;
begin
  begin
    perform public.atlas_release_freeze_candidate(repeat('f',40), 'release/unauthorized');
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'non-operator freeze unexpectedly succeeded'; end if;

  blocked := false;
  begin
    perform * from public.atlas_release_controller_state();
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'non-operator controller read unexpectedly succeeded'; end if;
end $$;
reset role;

-- Bootstrap one release operator through the service-only path.
set local role service_role;
select public.atlas_release_set_operator(
  (select operator_id from atlas_release_e2e_scope),
  true,
  'release-train E2E operator'
);
reset role;

-- Operator marks the two waves used by this E2E as integrated and freezes one SHA.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select operator_id::text from atlas_release_e2e_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select operator_id::text from atlas_release_e2e_scope),'role','authenticated')::text,true);

do $$
declare module_code text;
begin
  if not public.atlas_release_operator_status() then raise exception 'operator status not resolved'; end if;

  foreach module_code in array array[
    'core','identity','rbac','audit','security','release-controller',
    'finance','accounting'
  ] loop
    perform public.atlas_release_set_development_status(module_code, 'integrated', 'E2E integrated module');
  end loop;
end $$;

update atlas_release_e2e_scope
set candidate_id = public.atlas_release_freeze_candidate(candidate_sha, 'release/atlas-a-z');

-- Before evidence exists, the operator cannot queue even Core.
do $$
declare blocked boolean := false; v_candidate uuid;
begin
  select candidate_id into v_candidate from atlas_release_e2e_scope;
  begin
    perform public.atlas_release_queue_module(v_candidate, 'core');
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'module queued without executable evidence'; end if;
end $$;
reset role;

-- Frozen SHA is immutable even to the service execution role.
set local role service_role;
do $$
declare blocked boolean := false; v_candidate uuid;
begin
  select candidate_id into v_candidate from atlas_release_e2e_scope;
  begin
    update public.atlas_release_candidates set candidate_sha = repeat('b',40) where id = v_candidate;
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'frozen candidate SHA was mutable'; end if;
end $$;

-- Forge/service evidence for Wave 0 plus Finance/Accounting.
do $$
declare
  v_candidate uuid;
  module_code text;
  evidence_kind text;
begin
  select candidate_id into v_candidate from atlas_release_e2e_scope;

  foreach module_code in array array[
    'core','identity','rbac','audit','security','release-controller',
    'finance','accounting'
  ] loop
    foreach evidence_kind in array array['typecheck','unit','integration','security','build'] loop
      perform public.atlas_release_record_evidence(
        v_candidate, module_code, evidence_kind,
        'e2e:' || module_code || ':' || evidence_kind,
        true,
        jsonb_build_object('source','atlas-e2e')
      );
    end loop;

    if module_code in ('identity','rbac','security') then
      perform public.atlas_release_record_evidence(
        v_candidate, module_code, 'recovery',
        'e2e:' || module_code || ':recovery',
        true,
        jsonb_build_object('source','atlas-e2e')
      );
    end if;

    perform public.atlas_release_record_evidence(
      v_candidate, module_code, 'migration',
      'e2e:' || module_code || ':migration',
      true,
      jsonb_build_object('source','atlas-e2e','status','not_required')
    );

    perform public.atlas_release_record_evidence(
      v_candidate, module_code, 'provider',
      'e2e:' || module_code || ':provider',
      true,
      jsonb_build_object('source','atlas-e2e','status','not_required')
    );
  end loop;
end $$;
reset role;

-- Queue all Wave 0 prerequisites now that evidence exists.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select operator_id::text from atlas_release_e2e_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select operator_id::text from atlas_release_e2e_scope),'role','authenticated')::text,true);

do $$
declare v_candidate uuid; module_code text;
begin
  select candidate_id into v_candidate from atlas_release_e2e_scope;
  foreach module_code in array array['core','identity','rbac','audit','security','release-controller'] loop
    perform public.atlas_release_queue_module(v_candidate, module_code);
  end loop;
end $$;
reset role;

-- Service records the exact production deployment SHA; this still keeps the lock closed.
set local role service_role;
select public.atlas_release_record_evidence(
  (select candidate_id from atlas_release_e2e_scope),
  null,
  'deployment',
  'e2e:deployment',
  true,
  jsonb_build_object(
    'source','atlas-e2e',
    'environment','production',
    'production_sha',(select candidate_sha from atlas_release_e2e_scope)
  )
);
reset role;

-- Operator opens the lock, activates Wave 0, and moves each module through live -> prod_verified.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select operator_id::text from atlas_release_e2e_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select operator_id::text from atlas_release_e2e_scope),'role','authenticated')::text,true);
select public.atlas_release_set_lock(true, 'E2E begin controlled activation');
select public.atlas_release_begin_activation(
  (select candidate_id from atlas_release_e2e_scope), 0, 'E2E Wave 0'
);

do $$
declare v_candidate uuid; v_sha text; module_code text;
begin
  select candidate_id,candidate_sha into v_candidate,v_sha from atlas_release_e2e_scope;
  foreach module_code in array array['core','identity','rbac','audit','security','release-controller'] loop
    perform public.atlas_release_mark_live(v_candidate, module_code, v_sha);
  end loop;
end $$;
reset role;

set local role service_role;
do $$
declare v_candidate uuid; v_sha text; module_code text;
begin
  select candidate_id,candidate_sha into v_candidate,v_sha from atlas_release_e2e_scope;
  foreach module_code in array array['core','identity','rbac','audit','security','release-controller'] loop
    perform public.atlas_release_record_evidence(
      v_candidate, module_code, 'smoke',
      'e2e:' || module_code || ':smoke',
      true,
      jsonb_build_object('source','atlas-e2e','production_sha',v_sha)
    );
  end loop;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select operator_id::text from atlas_release_e2e_scope),true);
select set_config('request.jwt.claims',json_build_object('sub',(select operator_id::text from atlas_release_e2e_scope),'role','authenticated')::text,true);
do $$
declare v_candidate uuid; v_sha text; module_code text;
begin
  select candidate_id,candidate_sha into v_candidate,v_sha from atlas_release_e2e_scope;
  foreach module_code in array array['core','identity','rbac','audit','security','release-controller'] loop
    perform public.atlas_release_mark_prod_verified(v_candidate, module_code, v_sha);
  end loop;
end $$;

-- Finance + Accounting can now queue and activate because Foundation is verified in this exact candidate.
select public.atlas_release_queue_module((select candidate_id from atlas_release_e2e_scope), 'finance');
select public.atlas_release_queue_module((select candidate_id from atlas_release_e2e_scope), 'accounting');
select public.atlas_release_begin_activation(
  (select candidate_id from atlas_release_e2e_scope), 1, 'E2E Wave 1'
);

-- Roll back the affected Wave 1 only. Wave 0 must remain active and verified.
select public.atlas_release_deactivate_wave(
  (select candidate_id from atlas_release_e2e_scope), 1, 'E2E forced rollback'
);

do $$
declare
  core_active boolean;
  core_verified boolean;
  finance_active boolean;
  accounting_active boolean;
  finance_status text;
  finance_exception text;
  lock_open boolean;
begin
  select activation_enabled,
         production_verified_at is not null
    into core_active,core_verified
  from public.atlas_release_modules where module_code='core';
  select activation_enabled into finance_active from public.atlas_release_modules where module_code='finance';
  select activation_enabled into accounting_active from public.atlas_release_modules where module_code='accounting';

  select lifecycle_status,exception_state
    into finance_status,finance_exception
  from public.atlas_release_queue_items
  where candidate_id=(select candidate_id from atlas_release_e2e_scope)
    and module_code='finance';

  select is_open into lock_open from public.atlas_release_state where singleton=true;

  if core_active is distinct from true or core_verified is distinct from true then
    raise exception 'Wave 0 was not preserved by Wave 1 rollback';
  end if;
  if finance_active or accounting_active then
    raise exception 'Wave 1 modules remained active after rollback';
  end if;
  if finance_status <> 'queued' or finance_exception <> 'rollback' then
    raise exception 'Wave 1 queue state did not record rollback';
  end if;
  if lock_open is distinct from false then
    raise exception 'rollback must close the global release lock';
  end if;
end $$;

-- Runtime projection reflects the surviving Wave 0 and disabled Wave 1.
do $$
declare core_active boolean; finance_active boolean; deployed_sha text;
begin
  select activation_enabled,candidate_sha into core_active,deployed_sha
  from public.atlas_release_runtime_state() where module_code='core';
  select activation_enabled into finance_active
  from public.atlas_release_runtime_state() where module_code='finance';

  if core_active is distinct from true then raise exception 'runtime Core should remain active'; end if;
  if finance_active is distinct from false then raise exception 'runtime Finance should be disabled after rollback'; end if;
  if deployed_sha is distinct from (select candidate_sha from atlas_release_e2e_scope) then
    raise exception 'runtime candidate SHA mismatch';
  end if;
end $$;

reset role;
rollback;
