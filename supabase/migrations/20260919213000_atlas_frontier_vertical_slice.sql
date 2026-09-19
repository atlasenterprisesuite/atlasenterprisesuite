-- ATLAS FRONTIER governed vertical slice.
-- Gameplay state is organization-scoped, server-authoritative and append-only audited.

insert into public.identity_permissions (code, description)
values
  ('frontier.read', 'Read the authenticated user ATLAS FRONTIER run and audit evidence.'),
  ('frontier.play', 'Execute governed ATLAS FRONTIER gameplay actions through the server Flow Controller.'),
  ('frontier.manage', 'Administer ATLAS FRONTIER capability and audit access for an organization.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'frontier.read'),
  ('owner', 'frontier.play'),
  ('owner', 'frontier.manage'),
  ('admin', 'frontier.read'),
  ('admin', 'frontier.play'),
  ('admin', 'frontier.manage')
on conflict do nothing;

create table if not exists public.frontier_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  aetherium integer not null default 0 check (aetherium >= 0),
  alloy integer not null default 0 check (alloy >= 0),
  biofiber integer not null default 0 check (biofiber >= 0),
  power_cores integer not null default 0 check (power_cores >= 0),
  habitats integer not null default 0 check (habitats >= 0),
  sky_grid_integrity integer not null default 0 check (sky_grid_integrity between 0 and 100),
  action_count integer not null default 0 check (action_count >= 0),
  storm_minutes integer not null default 12 check (storm_minutes >= 0),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frontier_runs_scope_check check (tenant_id = org_id),
  constraint frontier_runs_actor_unique unique (org_id, actor_user_id)
);

create table if not exists public.frontier_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null check (action in (
    'extract_aetherium','salvage_alloy','harvest_biofiber','craft_power_core','build_habitat','restore_sky_grid'
  )),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  previous_revision integer not null,
  resulting_revision integer not null,
  before_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint frontier_events_scope_check check (tenant_id = org_id),
  constraint frontier_events_idempotency_unique unique (org_id, actor_user_id, idempotency_key)
);

create index if not exists frontier_events_org_created_idx on public.frontier_events (org_id, created_at desc);

alter table public.frontier_runs enable row level security;
alter table public.frontier_events enable row level security;

revoke all on public.frontier_runs from anon, authenticated;
revoke all on public.frontier_events from anon, authenticated;
grant select on public.frontier_runs to authenticated;
grant select on public.frontier_events to authenticated;
grant all on public.frontier_runs to service_role;
grant all on public.frontier_events to service_role;

drop policy if exists frontier_runs_read_own on public.frontier_runs;
create policy frontier_runs_read_own
  on public.frontier_runs for select to authenticated
  using (
    actor_user_id = auth.uid()
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_events_read on public.frontier_events;
create policy frontier_events_read
  on public.frontier_events for select to authenticated
  using (
    (actor_user_id = auth.uid() and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

create or replace function public.frontier_apply_action(
  p_org_id uuid,
  p_action text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.frontier_runs%rowtype;
  v_existing public.frontier_events%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_org_id is null
     or not (
       public.has_identity_permission(p_org_id, 'frontier.play')
       or public.has_identity_permission(p_org_id, 'frontier.manage')
     ) then
    raise exception 'frontier_permission_denied' using errcode = '42501';
  end if;

  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) < 8 then
    raise exception 'frontier_invalid_idempotency_key' using errcode = '22023';
  end if;

  select * into v_existing
  from public.frontier_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_revision,
      'state', v_existing.resulting_state,
      'event_id', v_existing.id
    );
  end if;

  insert into public.frontier_runs (tenant_id, org_id, actor_user_id)
  values (p_org_id, p_org_id, v_user_id)
  on conflict (org_id, actor_user_id) do nothing;

  select * into v_run
  from public.frontier_runs
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if not found then
    raise exception 'frontier_run_unavailable';
  end if;

  v_before := jsonb_build_object(
    'aetherium', v_run.aetherium,
    'alloy', v_run.alloy,
    'biofiber', v_run.biofiber,
    'powerCores', v_run.power_cores,
    'habitats', v_run.habitats,
    'skyGridIntegrity', v_run.sky_grid_integrity,
    'actionCount', v_run.action_count,
    'stormMinutes', v_run.storm_minutes
  );

  case p_action
    when 'extract_aetherium' then
      v_run.aetherium := v_run.aetherium + 4;
    when 'salvage_alloy' then
      v_run.alloy := v_run.alloy + 3;
    when 'harvest_biofiber' then
      v_run.biofiber := v_run.biofiber + 3;
    when 'craft_power_core' then
      if v_run.aetherium < 20 or v_run.alloy < 10 or v_run.biofiber < 4 then
        raise exception 'frontier_insufficient_resources_power_core' using errcode = 'P0001';
      end if;
      v_run.aetherium := v_run.aetherium - 20;
      v_run.alloy := v_run.alloy - 10;
      v_run.biofiber := v_run.biofiber - 4;
      v_run.power_cores := v_run.power_cores + 1;
    when 'build_habitat' then
      if v_run.alloy < 12 or v_run.biofiber < 8 then
        raise exception 'frontier_insufficient_resources_habitat' using errcode = 'P0001';
      end if;
      v_run.alloy := v_run.alloy - 12;
      v_run.biofiber := v_run.biofiber - 8;
      v_run.habitats := v_run.habitats + 1;
    when 'restore_sky_grid' then
      if v_run.sky_grid_integrity >= 100 then
        raise exception 'frontier_sky_grid_already_stable' using errcode = 'P0001';
      end if;
      if v_run.power_cores < 1 or v_run.aetherium < 8 then
        raise exception 'frontier_insufficient_resources_sky_grid' using errcode = 'P0001';
      end if;
      v_run.power_cores := v_run.power_cores - 1;
      v_run.aetherium := v_run.aetherium - 8;
      v_run.sky_grid_integrity := least(100, v_run.sky_grid_integrity + 25);
    else
      raise exception 'frontier_unknown_action' using errcode = '22023';
  end case;

  v_run.action_count := v_run.action_count + 1;
  v_run.storm_minutes := greatest(0, v_run.storm_minutes - 1);
  v_run.revision := v_run.revision + 1;
  v_run.updated_at := now();

  update public.frontier_runs
  set aetherium = v_run.aetherium,
      alloy = v_run.alloy,
      biofiber = v_run.biofiber,
      power_cores = v_run.power_cores,
      habitats = v_run.habitats,
      sky_grid_integrity = v_run.sky_grid_integrity,
      action_count = v_run.action_count,
      storm_minutes = v_run.storm_minutes,
      revision = v_run.revision,
      updated_at = v_run.updated_at
  where id = v_run.id;

  v_after := jsonb_build_object(
    'aetherium', v_run.aetherium,
    'alloy', v_run.alloy,
    'biofiber', v_run.biofiber,
    'powerCores', v_run.power_cores,
    'habitats', v_run.habitats,
    'skyGridIntegrity', v_run.sky_grid_integrity,
    'actionCount', v_run.action_count,
    'stormMinutes', v_run.storm_minutes
  );

  insert into public.frontier_events (
    tenant_id, org_id, run_id, actor_user_id, action, idempotency_key,
    previous_revision, resulting_revision, before_state, resulting_state
  )
  values (
    p_org_id, p_org_id, v_run.id, v_user_id, p_action, btrim(p_idempotency_key),
    v_run.revision - 1, v_run.revision, v_before, v_after
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'revision', v_run.revision,
    'state', v_after,
    'event_id', v_event_id
  );
end;
$$;

revoke all on function public.frontier_apply_action(uuid, text, text) from public, anon;
grant execute on function public.frontier_apply_action(uuid, text, text) to authenticated;

comment on function public.frontier_apply_action(uuid, text, text) is
  'Server-authoritative ATLAS FRONTIER Flow Controller. Validates org permission, costs and idempotency, then commits run state and append-only event in one transaction.';
