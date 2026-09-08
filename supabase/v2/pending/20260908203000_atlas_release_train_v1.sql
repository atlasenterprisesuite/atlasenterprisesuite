-- ATLAS Release Train + Release Queue v1
-- Canonical backend: Supabase v2.
-- This migration defines release-control state only; it does not open the
-- release lock, activate modules, or deploy production code.

create table public.atlas_release_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.atlas_release_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_sha text not null unique check (candidate_sha ~ '^[0-9a-f]{40}$'),
  source_branch text not null check (length(trim(source_branch)) between 1 and 200),
  status text not null default 'frozen' check (status in ('frozen','deployed','closed','rolled_back')),
  created_by uuid references auth.users(id) on delete set null,
  frozen_at timestamptz not null default now(),
  deployed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.atlas_release_modules (
  module_code text primary key check (module_code ~ '^[a-z][a-z0-9-]*(\.[a-z0-9_-]+)*$'),
  registry_code text references public.module_registry(code) on delete set null,
  module_family text not null,
  release_wave integer not null check (release_wave between 0 and 7),
  sort_order integer not null check (sort_order > 0),
  dependencies text[] not null default array[]::text[],
  development_status text not null default 'developing'
    check (development_status in ('developing','integrated','test_pending')),
  development_exception text
    check (development_exception is null or development_exception in ('blocked','provider_required')),
  blocker_reason text,
  activation_enabled boolean not null default false,
  active_candidate_id uuid references public.atlas_release_candidates(id) on delete set null,
  production_sha text check (production_sha is null or production_sha ~ '^[0-9a-f]{40}$'),
  production_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (module_code <> all(dependencies))
);

create table public.atlas_release_state (
  singleton boolean primary key default true check (singleton = true),
  is_open boolean not null default false,
  deployed_candidate_id uuid references public.atlas_release_candidates(id) on delete set null,
  deployed_candidate_sha text check (deployed_candidate_sha is null or deployed_candidate_sha ~ '^[0-9a-f]{40}$'),
  active_wave integer check (active_wave is null or active_wave between 0 and 7),
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((deployed_candidate_id is null) = (deployed_candidate_sha is null))
);

insert into public.atlas_release_state(singleton, is_open)
values (true, false)
on conflict (singleton) do nothing;

create table public.atlas_release_queue_items (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.atlas_release_candidates(id) on delete cascade,
  module_code text not null references public.atlas_release_modules(module_code) on delete restrict,
  release_wave integer not null check (release_wave between 0 and 7),
  queue_position integer not null check (queue_position > 0),
  lifecycle_status text not null
    check (lifecycle_status in (
      'developing','integrated','test_pending','verified','release_ready',
      'queued','activating','live','prod_verified'
    )),
  exception_state text
    check (exception_state is null or exception_state in ('blocked','provider_required','rollback')),
  ci_status text not null default 'pending' check (ci_status in ('pending','passed','failed')),
  migration_status text not null default 'pending'
    check (migration_status in ('pending','not_required','replay_verified','applied','failed')),
  provider_status text not null default 'pending'
    check (provider_status in ('pending','not_required','provider_required','verified','failed')),
  security_status text not null default 'pending'
    check (security_status in ('pending','passed','failed')),
  blocker_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, module_code)
);

create table public.atlas_release_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.atlas_release_candidates(id) on delete cascade,
  module_code text references public.atlas_release_modules(module_code) on delete cascade,
  evidence_kind text not null check (evidence_kind in (
    'typecheck','unit','integration','security','build','migration','deployment','smoke',
    'provider','health_safety','payment_reconciliation','mobility_safety','recovery'
  )),
  source text not null default 'atlas-forge' check (length(trim(source)) between 1 and 120),
  source_ref text not null check (length(trim(source_ref)) between 1 and 500),
  passed boolean not null,
  details jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table public.atlas_release_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.atlas_release_candidates(id) on delete set null,
  module_code text references public.atlas_release_modules(module_code) on delete set null,
  release_wave integer check (release_wave is null or release_wave between 0 and 7),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 1 and 160),
  before_state jsonb,
  after_state jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index atlas_release_modules_wave_idx
  on public.atlas_release_modules(release_wave, sort_order, module_code);
create index atlas_release_queue_candidate_wave_idx
  on public.atlas_release_queue_items(candidate_id, release_wave, lifecycle_status, queue_position);
create index atlas_release_queue_module_idx
  on public.atlas_release_queue_items(module_code, candidate_id);
create index atlas_release_evidence_candidate_module_kind_idx
  on public.atlas_release_evidence(candidate_id, module_code, evidence_kind, recorded_at desc);
create index atlas_release_events_candidate_created_idx
  on public.atlas_release_events(candidate_id, created_at desc);

create or replace function public.atlas_release_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger atlas_release_operators_touch
before update on public.atlas_release_operators
for each row execute function public.atlas_release_touch_updated_at();

create trigger atlas_release_candidates_touch
before update on public.atlas_release_candidates
for each row execute function public.atlas_release_touch_updated_at();

create trigger atlas_release_modules_touch
before update on public.atlas_release_modules
for each row execute function public.atlas_release_touch_updated_at();

create trigger atlas_release_state_touch
before update on public.atlas_release_state
for each row execute function public.atlas_release_touch_updated_at();

create trigger atlas_release_queue_touch
before update on public.atlas_release_queue_items
for each row execute function public.atlas_release_touch_updated_at();

create or replace function public.atlas_release_enforce_candidate_immutability()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.frozen_at is not null and (
    new.candidate_sha is distinct from old.candidate_sha
    or new.source_branch is distinct from old.source_branch
  ) then
    raise exception 'Frozen release candidate SHA and source branch are immutable';
  end if;
  return new;
end;
$$;

create trigger atlas_release_candidate_immutable
before update on public.atlas_release_candidates
for each row execute function public.atlas_release_enforce_candidate_immutability();

create or replace function public.atlas_release_is_operator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.atlas_release_operators operator_row
    where operator_row.user_id = p_user_id
      and operator_row.active = true
  );
$$;

create or replace function public.atlas_release_operator_status()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.atlas_release_is_operator((select auth.uid())), false);
$$;

create or replace function public.atlas_release_required_evidence(p_module_code text)
returns text[]
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select array['typecheck','unit','integration','security','build']::text[]
    || case when p_module_code = 'health' then array['health_safety']::text[] else array[]::text[] end
    || case when p_module_code = 'atlas-pay' then array['payment_reconciliation']::text[] else array[]::text[] end
    || case when p_module_code in ('ride','gps-4d','telecom','autowash') then array['mobility_safety']::text[] else array[]::text[] end
    || case when p_module_code in ('identity','rbac','security') then array['recovery']::text[] else array[]::text[] end;
$$;

create or replace function public.atlas_release_candidate_module_has_required_evidence(
  p_candidate_id uuid,
  p_module_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from unnest(public.atlas_release_required_evidence(p_module_code)) required(kind)
    where coalesce((
      select evidence.passed
      from public.atlas_release_evidence evidence
      where evidence.candidate_id = p_candidate_id
        and evidence.module_code = p_module_code
        and evidence.evidence_kind = required.kind
      order by evidence.recorded_at desc, evidence.id desc
      limit 1
    ), false) = false
  );
$$;

create or replace function public.atlas_release_candidate_module_has_failed_required_evidence(
  p_candidate_id uuid,
  p_module_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from unnest(public.atlas_release_required_evidence(p_module_code)) required(kind)
    where (
      select evidence.passed
      from public.atlas_release_evidence evidence
      where evidence.candidate_id = p_candidate_id
        and evidence.module_code = p_module_code
        and evidence.evidence_kind = required.kind
      order by evidence.recorded_at desc, evidence.id desc
      limit 1
    ) = false
  );
$$;

create or replace function public.atlas_release_runtime_state()
returns table(
  module_code text,
  module_family text,
  release_wave integer,
  activation_enabled boolean,
  candidate_sha text,
  production_sha text,
  production_verified boolean,
  exception_state text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    module_row.module_code,
    module_row.module_family,
    module_row.release_wave,
    module_row.activation_enabled,
    state_row.deployed_candidate_sha,
    module_row.production_sha,
    module_row.production_sha is not distinct from state_row.deployed_candidate_sha
      and module_row.production_sha is not null
      and module_row.activation_enabled,
    coalesce(queue_row.exception_state, module_row.development_exception),
    greatest(module_row.updated_at, coalesce(queue_row.updated_at, module_row.updated_at))
  from public.atlas_release_modules module_row
  cross join public.atlas_release_state state_row
  left join public.atlas_release_queue_items queue_row
    on queue_row.candidate_id = state_row.deployed_candidate_id
   and queue_row.module_code = module_row.module_code
  where state_row.singleton = true
  order by module_row.release_wave, module_row.sort_order, module_row.module_code;
$$;

create or replace function public.atlas_release_controller_state()
returns table(
  module_code text,
  module_family text,
  release_wave integer,
  development_status text,
  development_exception text,
  candidate_id uuid,
  candidate_sha text,
  lifecycle_status text,
  exception_state text,
  ci_status text,
  migration_status text,
  provider_status text,
  security_status text,
  queue_position integer,
  activation_enabled boolean,
  production_sha text,
  production_verified boolean,
  blocker_reason text,
  release_lock_open boolean,
  active_wave integer,
  deployed_candidate_sha text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.atlas_release_is_operator((select auth.uid())) then
    raise exception 'Release operator authorization is required';
  end if;

  return query
  select
    module_row.module_code,
    module_row.module_family,
    module_row.release_wave,
    module_row.development_status,
    module_row.development_exception,
    queue_row.candidate_id,
    candidate_row.candidate_sha,
    queue_row.lifecycle_status,
    queue_row.exception_state,
    queue_row.ci_status,
    queue_row.migration_status,
    queue_row.provider_status,
    queue_row.security_status,
    queue_row.queue_position,
    module_row.activation_enabled,
    module_row.production_sha,
    module_row.production_sha is not distinct from candidate_row.candidate_sha
      and module_row.production_sha is not null
      and module_row.activation_enabled,
    coalesce(queue_row.blocker_reason, module_row.blocker_reason),
    state_row.is_open,
    state_row.active_wave,
    state_row.deployed_candidate_sha
  from public.atlas_release_modules module_row
  cross join public.atlas_release_state state_row
  left join public.atlas_release_queue_items queue_row
    on queue_row.candidate_id = (
      select candidate_latest.id
      from public.atlas_release_candidates candidate_latest
      where candidate_latest.status in ('frozen','deployed')
      order by candidate_latest.created_at desc, candidate_latest.id desc
      limit 1
    )
   and queue_row.module_code = module_row.module_code
  left join public.atlas_release_candidates candidate_row
    on candidate_row.id = queue_row.candidate_id
  where state_row.singleton = true
  order by module_row.release_wave, module_row.sort_order, module_row.module_code;
end;
$$;

create or replace function public.atlas_release_evidence_summary(
  p_candidate_id uuid,
  p_module_code text default null
)
returns table(
  evidence_kind text,
  source text,
  source_ref text,
  passed boolean,
  recorded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.atlas_release_is_operator((select auth.uid())) then
    raise exception 'Release operator authorization is required';
  end if;

  return query
  select evidence.evidence_kind, evidence.source, evidence.source_ref, evidence.passed, evidence.recorded_at
  from public.atlas_release_evidence evidence
  where evidence.candidate_id = p_candidate_id
    and (p_module_code is null or evidence.module_code = p_module_code)
  order by evidence.recorded_at desc, evidence.id desc;
end;
$$;

create or replace function public.atlas_release_set_operator(
  p_user_id uuid,
  p_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Valid release operator user is required';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Release operator change reason is required';
  end if;

  insert into public.atlas_release_operators(user_id, active, created_by)
  values (p_user_id, p_active, null)
  on conflict (user_id) do update set active = excluded.active;

  insert into public.atlas_release_events(actor_id, event_type, after_state, details)
  values (
    null,
    'release.operator.set',
    jsonb_build_object('user_id', p_user_id, 'active', p_active),
    jsonb_build_object('reason', trim(p_reason), 'execution', 'service_role')
  );

  return p_user_id;
end;
$$;

create or replace function public.atlas_release_set_development_status(
  p_module_code text,
  p_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_current text;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if p_status not in ('developing','integrated','test_pending') then
    raise exception 'Invalid development status';
  end if;

  select development_status into v_current
  from public.atlas_release_modules
  where module_code = p_module_code
  for update;

  if not found then
    raise exception 'Release module not found';
  end if;

  if p_status <> v_current and not (
    (v_current = 'developing' and p_status = 'integrated')
    or (v_current = 'integrated' and p_status = 'test_pending')
  ) then
    raise exception 'Development status transition is not allowed';
  end if;

  update public.atlas_release_modules
  set development_status = p_status,
      blocker_reason = case when p_status = 'test_pending' then null else blocker_reason end
  where module_code = p_module_code;

  insert into public.atlas_release_events(module_code, release_wave, actor_id, event_type, before_state, after_state, details)
  select
    module_code,
    release_wave,
    v_actor,
    'release.development.status',
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_status),
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  from public.atlas_release_modules where module_code = p_module_code;

  return p_module_code;
end;
$$;

create or replace function public.atlas_release_set_development_exception(
  p_module_code text,
  p_exception_state text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_before_exception text;
  v_before_reason text;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if p_exception_state is not null and p_exception_state not in ('blocked','provider_required') then
    raise exception 'Invalid development exception state';
  end if;
  if p_exception_state is not null and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Development exception reason is required';
  end if;

  select development_exception, blocker_reason
    into v_before_exception, v_before_reason
  from public.atlas_release_modules
  where module_code = p_module_code
  for update;

  if not found then
    raise exception 'Release module not found';
  end if;

  update public.atlas_release_modules
  set development_exception = p_exception_state,
      blocker_reason = case when p_exception_state is null then null else trim(p_reason) end
  where module_code = p_module_code;

  insert into public.atlas_release_events(module_code, release_wave, actor_id, event_type, before_state, after_state)
  select
    module_code,
    release_wave,
    v_actor,
    'release.development.exception',
    jsonb_build_object('exception_state', v_before_exception, 'blocker_reason', v_before_reason),
    jsonb_build_object('exception_state', p_exception_state, 'blocker_reason', case when p_exception_state is null then null else trim(p_reason) end)
  from public.atlas_release_modules where module_code = p_module_code;

  return p_module_code;
end;
$$;

create or replace function public.atlas_release_freeze_candidate(
  p_candidate_sha text,
  p_source_branch text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_candidate_id uuid;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if p_candidate_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Candidate SHA must be a full 40-character lowercase Git SHA';
  end if;
  if length(trim(coalesce(p_source_branch, ''))) = 0 then
    raise exception 'Source branch is required';
  end if;

  select id into v_candidate_id
  from public.atlas_release_candidates
  where candidate_sha = p_candidate_sha;

  if v_candidate_id is not null then
    return v_candidate_id;
  end if;

  insert into public.atlas_release_candidates(candidate_sha, source_branch, status, created_by)
  values (p_candidate_sha, trim(p_source_branch), 'frozen', v_actor)
  returning id into v_candidate_id;

  insert into public.atlas_release_queue_items(
    candidate_id, module_code, release_wave, queue_position, lifecycle_status,
    exception_state, blocker_reason
  )
  select
    v_candidate_id,
    module_row.module_code,
    module_row.release_wave,
    module_row.release_wave * 1000 + module_row.sort_order,
    case when module_row.activation_enabled then 'test_pending' else module_row.development_status end,
    module_row.development_exception,
    module_row.blocker_reason
  from public.atlas_release_modules module_row
  order by module_row.release_wave, module_row.sort_order;

  insert into public.atlas_release_events(candidate_id, actor_id, event_type, after_state)
  values (
    v_candidate_id,
    v_actor,
    'release.candidate.freeze',
    jsonb_build_object('candidate_sha', p_candidate_sha, 'source_branch', trim(p_source_branch))
  );

  return v_candidate_id;
end;
$$;

create or replace function public.atlas_release_set_exception(
  p_candidate_id uuid,
  p_module_code text,
  p_exception_state text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.atlas_release_queue_items%rowtype;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if p_exception_state is not null and p_exception_state not in ('blocked','provider_required','rollback') then
    raise exception 'Invalid release exception state';
  end if;
  if p_exception_state is not null and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Exception reason is required';
  end if;

  select * into v_item
  from public.atlas_release_queue_items
  where candidate_id = p_candidate_id and module_code = p_module_code
  for update;

  if not found then
    raise exception 'Release queue item not found';
  end if;

  update public.atlas_release_queue_items
  set exception_state = p_exception_state,
      blocker_reason = case when p_exception_state is null then null else trim(p_reason) end,
      provider_status = case
        when p_exception_state = 'provider_required' then 'provider_required'
        else provider_status
      end
  where id = v_item.id;

  insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state, details)
  values (
    p_candidate_id,
    p_module_code,
    v_item.release_wave,
    v_actor,
    'release.exception.set',
    jsonb_build_object('exception_state', v_item.exception_state, 'blocker_reason', v_item.blocker_reason),
    jsonb_build_object('exception_state', p_exception_state, 'blocker_reason', case when p_exception_state is null then null else trim(p_reason) end),
    '{}'::jsonb
  );

  return v_item.id;
end;
$$;

create or replace function public.atlas_release_record_evidence(
  p_candidate_id uuid,
  p_module_code text,
  p_evidence_kind text,
  p_source_ref text,
  p_passed boolean,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidence_id uuid;
  v_source text := coalesce(nullif(trim(coalesce(p_details->>'source', '')), ''), 'atlas-forge');
  v_candidate_sha text;
  v_status text;
  v_latest_failed boolean;
begin
  select candidate_sha into v_candidate_sha
  from public.atlas_release_candidates
  where id = p_candidate_id;

  if not found then
    raise exception 'Release candidate not found';
  end if;
  if p_evidence_kind not in (
    'typecheck','unit','integration','security','build','migration','deployment','smoke',
    'provider','health_safety','payment_reconciliation','mobility_safety','recovery'
  ) then
    raise exception 'Invalid release evidence kind';
  end if;
  if length(trim(coalesce(p_source_ref, ''))) = 0 then
    raise exception 'Evidence source reference is required';
  end if;
  if p_module_code is not null and not exists (
    select 1 from public.atlas_release_queue_items
    where candidate_id = p_candidate_id and module_code = p_module_code
  ) then
    raise exception 'Release queue item not found for evidence';
  end if;

  insert into public.atlas_release_evidence(
    candidate_id, module_code, evidence_kind, source, source_ref, passed, details
  ) values (
    p_candidate_id, p_module_code, p_evidence_kind, v_source, trim(p_source_ref), p_passed, coalesce(p_details, '{}'::jsonb)
  ) returning id into v_evidence_id;

  if p_module_code is not null then
    if p_evidence_kind = 'security' then
      update public.atlas_release_queue_items
      set security_status = case when p_passed then 'passed' else 'failed' end,
          lifecycle_status = case when lifecycle_status = 'integrated' then 'test_pending' else lifecycle_status end
      where candidate_id = p_candidate_id and module_code = p_module_code;
    elsif p_evidence_kind = 'migration' then
      if not p_passed then
        v_status := 'failed';
      else
        v_status := coalesce(p_details->>'status', '');
        if v_status not in ('not_required','replay_verified','applied') then
          raise exception 'Migration evidence status must be not_required, replay_verified, or applied';
        end if;
      end if;
      update public.atlas_release_queue_items
      set migration_status = v_status,
          lifecycle_status = case when lifecycle_status = 'integrated' then 'test_pending' else lifecycle_status end
      where candidate_id = p_candidate_id and module_code = p_module_code;
    elsif p_evidence_kind = 'provider' then
      if not p_passed then
        v_status := 'failed';
      else
        v_status := coalesce(p_details->>'status', '');
        if v_status not in ('not_required','provider_required','verified') then
          raise exception 'Provider evidence status must be not_required, provider_required, or verified';
        end if;
      end if;
      update public.atlas_release_queue_items
      set provider_status = v_status,
          exception_state = case
            when v_status = 'provider_required' then 'provider_required'
            when exception_state = 'provider_required' then null
            else exception_state
          end,
          blocker_reason = case
            when v_status = 'provider_required' then coalesce(nullif(trim(coalesce(p_details->>'reason', '')), ''), 'External provider capability is not configured.')
            when exception_state = 'provider_required' then null
            else blocker_reason
          end,
          lifecycle_status = case when lifecycle_status = 'integrated' then 'test_pending' else lifecycle_status end
      where candidate_id = p_candidate_id and module_code = p_module_code;
    elsif p_evidence_kind in ('typecheck','unit','integration','build','health_safety','payment_reconciliation','mobility_safety','recovery') then
      update public.atlas_release_queue_items
      set lifecycle_status = case when lifecycle_status = 'integrated' then 'test_pending' else lifecycle_status end
      where candidate_id = p_candidate_id and module_code = p_module_code;
    end if;

    select public.atlas_release_candidate_module_has_failed_required_evidence(p_candidate_id, p_module_code)
    into v_latest_failed;

    update public.atlas_release_queue_items
    set ci_status = case
      when v_latest_failed then 'failed'
      when public.atlas_release_candidate_module_has_required_evidence(p_candidate_id, p_module_code) then 'passed'
      else 'pending'
    end
    where candidate_id = p_candidate_id and module_code = p_module_code;
  end if;

  if p_module_code is null and p_evidence_kind = 'deployment' and p_passed then
    if coalesce(p_details->>'production_sha', '') <> v_candidate_sha then
      raise exception 'Deployment evidence production SHA must match frozen candidate SHA';
    end if;
    if coalesce(p_details->>'environment', 'production') <> 'production' then
      raise exception 'Deployment evidence must identify the production environment';
    end if;

    update public.atlas_release_candidates
    set status = 'deployed', deployed_at = now()
    where id = p_candidate_id;

    update public.atlas_release_state
    set deployed_candidate_id = p_candidate_id,
        deployed_candidate_sha = v_candidate_sha,
        active_wave = null,
        is_open = false,
        opened_by = null,
        opened_at = null
    where singleton = true;

    insert into public.atlas_release_events(candidate_id, event_type, after_state, details)
    values (
      p_candidate_id,
      'release.candidate.deployed',
      jsonb_build_object('candidate_sha', v_candidate_sha),
      jsonb_build_object('source_ref', trim(p_source_ref), 'source', v_source)
    );
  end if;

  return v_evidence_id;
end;
$$;

create or replace function public.atlas_release_queue_module(
  p_candidate_id uuid,
  p_module_code text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.atlas_release_queue_items%rowtype;
  v_previous text;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;

  select * into v_item
  from public.atlas_release_queue_items
  where candidate_id = p_candidate_id and module_code = p_module_code
  for update;

  if not found then
    raise exception 'Release queue item not found';
  end if;
  if v_item.lifecycle_status = 'queued' then
    return v_item.id;
  end if;
  if v_item.lifecycle_status not in ('integrated','test_pending','verified','release_ready') then
    raise exception 'Module is not eligible for release queue promotion';
  end if;

  if v_item.lifecycle_status = 'integrated' then
    update public.atlas_release_queue_items set lifecycle_status = 'test_pending' where id = v_item.id;
    v_item.lifecycle_status := 'test_pending';
  end if;

  if v_item.lifecycle_status = 'test_pending' then
    if not public.atlas_release_candidate_module_has_required_evidence(p_candidate_id, p_module_code) then
      raise exception 'Executable release evidence is incomplete or failing';
    end if;
    v_previous := v_item.lifecycle_status;
    update public.atlas_release_queue_items
    set lifecycle_status = 'verified', ci_status = 'passed', security_status = 'passed'
    where id = v_item.id;
    insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state)
    values (p_candidate_id, p_module_code, v_item.release_wave, v_actor, 'release.module.verified', jsonb_build_object('status', v_previous), jsonb_build_object('status', 'verified'));
    v_item.lifecycle_status := 'verified';
  end if;

  if v_item.lifecycle_status = 'verified' then
    select * into v_item from public.atlas_release_queue_items where id = v_item.id for update;
    if v_item.ci_status <> 'passed' or v_item.security_status <> 'passed' then
      raise exception 'CI and security gates must pass before release readiness';
    end if;
    if v_item.migration_status not in ('not_required','replay_verified','applied') then
      raise exception 'Migration readiness evidence is incomplete';
    end if;
    if v_item.provider_status not in ('not_required','provider_required','verified') then
      raise exception 'Provider readiness evidence is incomplete';
    end if;
    if v_item.exception_state is not null and v_item.exception_state <> 'provider_required' then
      raise exception 'Blocking release exception must be cleared';
    end if;

    update public.atlas_release_queue_items set lifecycle_status = 'release_ready' where id = v_item.id;
    insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state)
    values (p_candidate_id, p_module_code, v_item.release_wave, v_actor, 'release.module.ready', jsonb_build_object('status', 'verified'), jsonb_build_object('status', 'release_ready'));
    v_item.lifecycle_status := 'release_ready';
  end if;

  if v_item.lifecycle_status = 'release_ready' then
    update public.atlas_release_queue_items set lifecycle_status = 'queued' where id = v_item.id;
    insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state)
    values (p_candidate_id, p_module_code, v_item.release_wave, v_actor, 'release.module.queued', jsonb_build_object('status', 'release_ready'), jsonb_build_object('status', 'queued'));
  end if;

  return v_item.id;
end;
$$;

create or replace function public.atlas_release_set_lock(
  p_open boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_state public.atlas_release_state%rowtype;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Release lock change reason is required';
  end if;

  select * into v_state from public.atlas_release_state where singleton = true for update;

  if p_open and v_state.deployed_candidate_id is null then
    raise exception 'A deployed candidate is required before opening the release lock';
  end if;

  update public.atlas_release_state
  set is_open = p_open,
      opened_by = case when p_open then v_actor else null end,
      opened_at = case when p_open then now() else null end
  where singleton = true;

  insert into public.atlas_release_events(candidate_id, actor_id, event_type, before_state, after_state, details)
  values (
    v_state.deployed_candidate_id,
    v_actor,
    'release.lock.set',
    jsonb_build_object('is_open', v_state.is_open),
    jsonb_build_object('is_open', p_open),
    jsonb_build_object('reason', trim(p_reason))
  );

  return p_open;
end;
$$;

create or replace function public.atlas_release_begin_activation(
  p_candidate_id uuid,
  p_release_wave integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_state public.atlas_release_state%rowtype;
  v_count integer;
  v_dependency_module text;
  v_dependency_owner text;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if p_release_wave < 0 or p_release_wave > 7 then
    raise exception 'Release wave must be between 0 and 7';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Activation reason is required';
  end if;

  select * into v_state from public.atlas_release_state where singleton = true for update;

  if not v_state.is_open then
    raise exception 'Global release lock is closed';
  end if;
  if v_state.deployed_candidate_id is distinct from p_candidate_id then
    raise exception 'Activation candidate does not match deployed candidate';
  end if;
  if v_state.active_wave is not null then
    raise exception 'Another release wave is already active';
  end if;

  if exists (
    select 1
    from public.atlas_release_queue_items queue_row
    where queue_row.candidate_id = p_candidate_id
      and queue_row.release_wave = p_release_wave
      and queue_row.lifecycle_status = 'queued'
      and (
        queue_row.migration_status not in ('not_required','applied')
        or queue_row.provider_status not in ('not_required','provider_required','verified')
        or queue_row.security_status <> 'passed'
        or (queue_row.exception_state is not null and queue_row.exception_state <> 'provider_required')
      )
  ) then
    raise exception 'Queued module readiness is insufficient for activation';
  end if;

  select dependency.module_code, dependency.dependency_code
  into v_dependency_owner, v_dependency_module
  from (
    select queue_row.module_code, unnest(module_row.dependencies) as dependency_code
    from public.atlas_release_queue_items queue_row
    join public.atlas_release_modules module_row on module_row.module_code = queue_row.module_code
    where queue_row.candidate_id = p_candidate_id
      and queue_row.release_wave = p_release_wave
      and queue_row.lifecycle_status = 'queued'
  ) dependency
  where not (
    exists (
      select 1
      from public.atlas_release_queue_items verified_dependency
      where verified_dependency.candidate_id = p_candidate_id
        and verified_dependency.module_code = dependency.dependency_code
        and verified_dependency.lifecycle_status = 'prod_verified'
    )
    or exists (
      select 1
      from public.atlas_release_queue_items same_wave
      where same_wave.candidate_id = p_candidate_id
        and same_wave.module_code = dependency.dependency_code
        and same_wave.release_wave = p_release_wave
        and same_wave.lifecycle_status in ('queued','activating','live','prod_verified')
    )
  )
  limit 1;

  if v_dependency_module is not null then
    raise exception 'Unmet release dependency: % requires %', v_dependency_owner, v_dependency_module;
  end if;

  select count(*) into v_count
  from public.atlas_release_queue_items
  where candidate_id = p_candidate_id
    and release_wave = p_release_wave
    and lifecycle_status = 'queued';

  if v_count = 0 then
    raise exception 'No queued modules are available for this wave';
  end if;

  update public.atlas_release_state
  set active_wave = p_release_wave
  where singleton = true;

  update public.atlas_release_modules module_row
  set activation_enabled = true,
      active_candidate_id = p_candidate_id
  from public.atlas_release_queue_items queue_row
  where queue_row.candidate_id = p_candidate_id
    and queue_row.release_wave = p_release_wave
    and queue_row.lifecycle_status = 'queued'
    and module_row.module_code = queue_row.module_code;

  update public.atlas_release_queue_items
  set lifecycle_status = 'activating', exception_state = case when exception_state = 'rollback' then null else exception_state end
  where candidate_id = p_candidate_id
    and release_wave = p_release_wave
    and lifecycle_status = 'queued';

  insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state, details)
  select
    p_candidate_id,
    queue_row.module_code,
    p_release_wave,
    v_actor,
    'release.module.activating',
    jsonb_build_object('status', 'queued'),
    jsonb_build_object('status', 'activating', 'activation_enabled', true),
    jsonb_build_object('reason', trim(p_reason))
  from public.atlas_release_queue_items queue_row
  where queue_row.candidate_id = p_candidate_id
    and queue_row.release_wave = p_release_wave
    and queue_row.lifecycle_status = 'activating';

  return v_count;
end;
$$;

create or replace function public.atlas_release_mark_live(
  p_candidate_id uuid,
  p_module_code text,
  p_production_sha text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.atlas_release_queue_items%rowtype;
  v_state public.atlas_release_state%rowtype;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;

  select * into v_state from public.atlas_release_state where singleton = true;
  if v_state.deployed_candidate_id is distinct from p_candidate_id
     or v_state.deployed_candidate_sha is distinct from p_production_sha then
    raise exception 'Production SHA does not match deployed candidate';
  end if;

  select * into v_item
  from public.atlas_release_queue_items
  where candidate_id = p_candidate_id and module_code = p_module_code
  for update;

  if not found or v_item.lifecycle_status <> 'activating' then
    raise exception 'Module must be activating before it can be marked live';
  end if;
  if not exists (
    select 1 from public.atlas_release_modules
    where module_code = p_module_code
      and activation_enabled = true
      and active_candidate_id = p_candidate_id
  ) then
    raise exception 'Module activation registry is not enabled for this candidate';
  end if;

  update public.atlas_release_queue_items set lifecycle_status = 'live' where id = v_item.id;

  insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state)
  values (
    p_candidate_id, p_module_code, v_item.release_wave, v_actor,
    'release.module.live',
    jsonb_build_object('status', 'activating'),
    jsonb_build_object('status', 'live', 'production_sha', p_production_sha)
  );

  return v_item.id;
end;
$$;

create or replace function public.atlas_release_mark_prod_verified(
  p_candidate_id uuid,
  p_module_code text,
  p_production_sha text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.atlas_release_queue_items%rowtype;
  v_state public.atlas_release_state%rowtype;
  v_latest_smoke boolean;
  v_latest_smoke_sha text;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;

  select * into v_state from public.atlas_release_state where singleton = true for update;
  if v_state.deployed_candidate_id is distinct from p_candidate_id
     or v_state.deployed_candidate_sha is distinct from p_production_sha then
    raise exception 'Production SHA does not match deployed candidate';
  end if;

  select * into v_item
  from public.atlas_release_queue_items
  where candidate_id = p_candidate_id and module_code = p_module_code
  for update;

  if not found or v_item.lifecycle_status <> 'live' then
    raise exception 'Module must be live before production verification';
  end if;

  select evidence.passed, evidence.details->>'production_sha'
  into v_latest_smoke, v_latest_smoke_sha
  from public.atlas_release_evidence evidence
  where evidence.candidate_id = p_candidate_id
    and evidence.module_code = p_module_code
    and evidence.evidence_kind = 'smoke'
  order by evidence.recorded_at desc, evidence.id desc
  limit 1;

  if v_latest_smoke is distinct from true or v_latest_smoke_sha is distinct from p_production_sha then
    raise exception 'Passing smoke evidence for the exact production SHA is required';
  end if;

  update public.atlas_release_queue_items
  set lifecycle_status = 'prod_verified', exception_state = case when exception_state = 'rollback' then null else exception_state end
  where id = v_item.id;

  update public.atlas_release_modules
  set activation_enabled = true,
      active_candidate_id = p_candidate_id,
      production_sha = p_production_sha,
      production_verified_at = now()
  where module_code = p_module_code;

  insert into public.atlas_release_events(candidate_id, module_code, release_wave, actor_id, event_type, before_state, after_state)
  values (
    p_candidate_id, p_module_code, v_item.release_wave, v_actor,
    'release.module.prod_verified',
    jsonb_build_object('status', 'live'),
    jsonb_build_object('status', 'prod_verified', 'production_sha', p_production_sha)
  );

  if not exists (
    select 1 from public.atlas_release_queue_items
    where candidate_id = p_candidate_id
      and release_wave = v_item.release_wave
      and lifecycle_status in ('activating','live')
  ) then
    update public.atlas_release_state set active_wave = null where singleton = true;
  end if;

  return v_item.id;
end;
$$;

create or replace function public.atlas_release_deactivate_wave(
  p_candidate_id uuid,
  p_release_wave integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_count integer;
begin
  if not public.atlas_release_is_operator(v_actor) then
    raise exception 'Release operator authorization is required';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Rollback reason is required';
  end if;

  select count(*) into v_count
  from public.atlas_release_modules module_row
  where module_row.release_wave = p_release_wave
    and module_row.activation_enabled = true
    and module_row.active_candidate_id = p_candidate_id;

  update public.atlas_release_modules
  set activation_enabled = false,
      active_candidate_id = null
  where release_wave = p_release_wave
    and active_candidate_id = p_candidate_id;

  update public.atlas_release_queue_items
  set lifecycle_status = 'queued',
      exception_state = 'rollback',
      blocker_reason = trim(p_reason)
  where candidate_id = p_candidate_id
    and release_wave = p_release_wave
    and lifecycle_status in ('activating','live','prod_verified');

  update public.atlas_release_state
  set active_wave = null,
      is_open = false,
      opened_by = null,
      opened_at = null
  where singleton = true;

  insert into public.atlas_release_events(candidate_id, release_wave, actor_id, event_type, after_state, details)
  values (
    p_candidate_id,
    p_release_wave,
    v_actor,
    'release.wave.rollback',
    jsonb_build_object('activation_enabled', false, 'status', 'queued', 'exception_state', 'rollback'),
    jsonb_build_object('reason', trim(p_reason), 'affected_modules', v_count)
  );

  return v_count;
end;
$$;

insert into public.atlas_release_modules(
  module_code, registry_code, module_family, release_wave, sort_order, dependencies
)
values
  ('core', 'core', 'foundation', 0, 10, array[]::text[]),
  ('identity', null, 'foundation', 0, 20, array['core']),
  ('rbac', null, 'foundation', 0, 30, array['core','identity']),
  ('audit', null, 'foundation', 0, 40, array['core','identity']),
  ('security', null, 'foundation', 0, 50, array['core','identity','rbac','audit']),
  ('settings', null, 'foundation', 0, 60, array['core','identity','rbac']),
  ('atlas-manager', null, 'foundation', 0, 70, array['core','identity','rbac','audit']),
  ('observability', null, 'foundation', 0, 80, array['core','audit']),
  ('release-controller', null, 'foundation', 0, 90, array['core','identity','rbac','audit','security']),
  ('finance', null, 'finance', 1, 110, array['core','identity','rbac','audit','release-controller']),
  ('accounting', 'finance.accounting', 'finance', 1, 120, array['core','identity','rbac','audit','release-controller','finance']),
  ('gl', 'finance.accounting', 'finance', 1, 130, array['core','identity','rbac','audit','release-controller','accounting']),
  ('ap', 'finance.accounting', 'finance', 1, 140, array['core','identity','rbac','audit','release-controller','accounting']),
  ('ar', 'finance.accounting', 'finance', 1, 150, array['core','identity','rbac','audit','release-controller','accounting']),
  ('bank-cash', 'finance.accounting', 'finance', 1, 160, array['core','identity','rbac','audit','release-controller','accounting']),
  ('reconciliation', 'finance.accounting', 'finance', 1, 170, array['core','identity','rbac','audit','release-controller','accounting']),
  ('hr', 'people', 'people', 2, 210, array['core','identity','rbac','audit','release-controller']),
  ('time', 'people', 'people', 2, 220, array['core','identity','rbac','audit','release-controller','hr']),
  ('payroll', 'people', 'people', 2, 230, array['core','identity','rbac','audit','release-controller','hr','time','accounting']),
  ('recruiting', 'people', 'people', 2, 240, array['core','identity','rbac','audit','release-controller','hr']),
  ('assessments', 'people', 'people', 2, 250, array['core','identity','rbac','audit','release-controller','recruiting']),
  ('compensation', 'people', 'people', 2, 260, array['core','identity','rbac','audit','release-controller','hr','payroll','accounting']),
  ('benefits', 'people', 'people', 2, 270, array['core','identity','rbac','audit','release-controller','hr','payroll']),
  ('self-service', 'people', 'people', 2, 280, array['core','identity','rbac','audit','release-controller','hr','time','payroll']),
  ('crm', null, 'revenue-operations', 3, 310, array['core','identity','rbac','audit','release-controller']),
  ('sales', null, 'revenue-operations', 3, 320, array['core','identity','rbac','audit','release-controller','crm','customers','accounting']),
  ('customers', null, 'revenue-operations', 3, 330, array['core','identity','rbac','audit','release-controller']),
  ('vendors', null, 'revenue-operations', 3, 340, array['core','identity','rbac','audit','release-controller']),
  ('purchasing', null, 'revenue-operations', 3, 350, array['core','identity','rbac','audit','release-controller','vendors','inventory','accounting']),
  ('inventory', null, 'revenue-operations', 3, 360, array['core','identity','rbac','audit','release-controller']),
  ('pos', null, 'revenue-operations', 3, 370, array['core','identity','rbac','audit','release-controller','sales','inventory','accounting']),
  ('projects', null, 'revenue-operations', 3, 380, array['core','identity','rbac','audit','release-controller']),
  ('analytics', null, 'revenue-operations', 3, 390, array['core','identity','rbac','audit','release-controller','accounting']),
  ('drive', null, 'platform-services', 4, 410, array['core','identity','rbac','audit','release-controller']),
  ('knowledge', null, 'platform-services', 4, 420, array['core','identity','rbac','audit','release-controller']),
  ('voice', null, 'platform-services', 4, 430, array['core','identity','rbac','audit','release-controller']),
  ('connect', null, 'platform-services', 4, 440, array['core','identity','rbac','audit','release-controller']),
  ('communications', null, 'platform-services', 4, 450, array['core','identity','rbac','audit','release-controller']),
  ('creator-studio', null, 'platform-services', 4, 460, array['core','identity','rbac','audit','release-controller']),
  ('sites', null, 'platform-services', 4, 470, array['core','identity','rbac','audit','release-controller']),
  ('health', 'health', 'health', 5, 510, array['core','identity','rbac','audit','release-controller']),
  ('ride', 'mobility.ride', 'mobility-physical-operations', 6, 610, array['core','identity','rbac','audit','release-controller']),
  ('gps-4d', null, 'mobility-physical-operations', 6, 620, array['core','identity','rbac','audit','release-controller']),
  ('telecom', 'telecom', 'mobility-physical-operations', 6, 630, array['core','identity','rbac','audit','release-controller']),
  ('parks', null, 'mobility-physical-operations', 6, 640, array['core','identity','rbac','audit','release-controller']),
  ('autowash', null, 'mobility-physical-operations', 6, 650, array['core','identity','rbac','audit','release-controller']),
  ('insurance', null, 'mobility-physical-operations', 6, 660, array['core','identity','rbac','audit','release-controller']),
  ('atlas-pay', null, 'financial-rails-specialized', 7, 710, array['core','identity','rbac','audit','release-controller','accounting']),
  ('venezuela', null, 'financial-rails-specialized', 7, 720, array['core','identity','rbac','audit','release-controller','accounting']),
  ('specialized', null, 'financial-rails-specialized', 7, 730, array['core','identity','rbac','audit','release-controller'])
on conflict (module_code) do update
set registry_code = excluded.registry_code,
    module_family = excluded.module_family,
    release_wave = excluded.release_wave,
    sort_order = excluded.sort_order,
    dependencies = excluded.dependencies;

alter table public.atlas_release_operators enable row level security;
alter table public.atlas_release_candidates enable row level security;
alter table public.atlas_release_modules enable row level security;
alter table public.atlas_release_state enable row level security;
alter table public.atlas_release_queue_items enable row level security;
alter table public.atlas_release_evidence enable row level security;
alter table public.atlas_release_events enable row level security;

revoke all on public.atlas_release_operators,
  public.atlas_release_candidates,
  public.atlas_release_modules,
  public.atlas_release_state,
  public.atlas_release_queue_items,
  public.atlas_release_evidence,
  public.atlas_release_events
from anon, authenticated;

grant all on public.atlas_release_operators,
  public.atlas_release_candidates,
  public.atlas_release_modules,
  public.atlas_release_state,
  public.atlas_release_queue_items,
  public.atlas_release_evidence,
  public.atlas_release_events
to service_role;

revoke all on function public.atlas_release_touch_updated_at() from public, anon, authenticated;
revoke all on function public.atlas_release_enforce_candidate_immutability() from public, anon, authenticated;
revoke all on function public.atlas_release_is_operator(uuid) from public, anon;
revoke all on function public.atlas_release_operator_status() from public, anon;
revoke all on function public.atlas_release_required_evidence(text) from public, anon;
revoke all on function public.atlas_release_candidate_module_has_required_evidence(uuid, text) from public, anon, authenticated;
revoke all on function public.atlas_release_candidate_module_has_failed_required_evidence(uuid, text) from public, anon, authenticated;
revoke all on function public.atlas_release_runtime_state() from public, anon;
revoke all on function public.atlas_release_controller_state() from public, anon;
revoke all on function public.atlas_release_evidence_summary(uuid, text) from public, anon;
revoke all on function public.atlas_release_set_operator(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.atlas_release_set_development_status(text, text, text) from public, anon;
revoke all on function public.atlas_release_set_development_exception(text, text, text) from public, anon;
revoke all on function public.atlas_release_freeze_candidate(text, text) from public, anon;
revoke all on function public.atlas_release_set_exception(uuid, text, text, text) from public, anon;
revoke all on function public.atlas_release_record_evidence(uuid, text, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.atlas_release_queue_module(uuid, text) from public, anon;
revoke all on function public.atlas_release_set_lock(boolean, text) from public, anon;
revoke all on function public.atlas_release_begin_activation(uuid, integer, text) from public, anon;
revoke all on function public.atlas_release_mark_live(uuid, text, text) from public, anon;
revoke all on function public.atlas_release_mark_prod_verified(uuid, text, text) from public, anon;
revoke all on function public.atlas_release_deactivate_wave(uuid, integer, text) from public, anon;

grant execute on function public.atlas_release_operator_status() to authenticated;
grant execute on function public.atlas_release_required_evidence(text) to authenticated;
grant execute on function public.atlas_release_runtime_state() to authenticated;
grant execute on function public.atlas_release_controller_state() to authenticated;
grant execute on function public.atlas_release_evidence_summary(uuid, text) to authenticated;
grant execute on function public.atlas_release_set_development_status(text, text, text) to authenticated;
grant execute on function public.atlas_release_set_development_exception(text, text, text) to authenticated;
grant execute on function public.atlas_release_freeze_candidate(text, text) to authenticated;
grant execute on function public.atlas_release_set_exception(uuid, text, text, text) to authenticated;
grant execute on function public.atlas_release_queue_module(uuid, text) to authenticated;
grant execute on function public.atlas_release_set_lock(boolean, text) to authenticated;
grant execute on function public.atlas_release_begin_activation(uuid, integer, text) to authenticated;
grant execute on function public.atlas_release_mark_live(uuid, text, text) to authenticated;
grant execute on function public.atlas_release_mark_prod_verified(uuid, text, text) to authenticated;
grant execute on function public.atlas_release_deactivate_wave(uuid, integer, text) to authenticated;

grant execute on function public.atlas_release_set_operator(uuid, boolean, text) to service_role;
grant execute on function public.atlas_release_record_evidence(uuid, text, text, text, boolean, jsonb) to service_role;
