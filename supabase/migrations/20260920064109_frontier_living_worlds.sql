-- ATLAS FRONTIER Living Worlds.
-- Adds server-authoritative ecology progression without weakening the governed world or spatial build boundary.

alter table public.frontier_runs
  drop constraint if exists frontier_runs_campaign_stage_check;

alter table public.frontier_runs
  add constraint frontier_runs_campaign_stage_check
  check (campaign_stage between 1 and 6);

create table if not exists public.frontier_ecology (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seed_pods integer not null default 0 check (seed_pods >= 0),
  cultivated_plots integer not null default 0 check (cultivated_plots >= 0),
  eco_energy integer not null default 0 check (eco_energy between 0 and 100),
  ecosystem_stability integer not null default 0 check (ecosystem_stability between 0 and 100),
  restored_biomes integer not null default 0 check (restored_biomes >= 0),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frontier_ecology_scope_check check (tenant_id = org_id),
  constraint frontier_ecology_actor_unique unique (org_id, actor_user_id)
);

create table if not exists public.frontier_ecology_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  ecology_id uuid not null references public.frontier_ecology(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null check (action in (
    'collect_seed_pods',
    'cultivate_plot',
    'generate_eco_energy',
    'restore_biome'
  )),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  previous_run_revision integer not null check (previous_run_revision >= 0),
  resulting_run_revision integer not null check (resulting_run_revision >= 0),
  previous_ecology_revision integer not null check (previous_ecology_revision >= 0),
  resulting_ecology_revision integer not null check (resulting_ecology_revision >= 0),
  before_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint frontier_ecology_events_scope_check check (tenant_id = org_id),
  constraint frontier_ecology_events_idempotency_unique unique (org_id, actor_user_id, idempotency_key)
);

create index if not exists frontier_ecology_tenant_idx on public.frontier_ecology (tenant_id);
create index if not exists frontier_ecology_run_idx on public.frontier_ecology (run_id);
create index if not exists frontier_ecology_actor_idx on public.frontier_ecology (actor_user_id);
create index if not exists frontier_ecology_events_tenant_idx on public.frontier_ecology_events (tenant_id);
create index if not exists frontier_ecology_events_run_idx on public.frontier_ecology_events (run_id);
create index if not exists frontier_ecology_events_ecology_idx on public.frontier_ecology_events (ecology_id);
create index if not exists frontier_ecology_events_actor_idx on public.frontier_ecology_events (actor_user_id);
create index if not exists frontier_ecology_events_created_idx on public.frontier_ecology_events (org_id, created_at desc);

comment on table public.frontier_ecology is
  'Organization-scoped ATLAS FRONTIER living-world state. Browser writes are prohibited; ecology actions are committed only through the governed Living Systems Controller.';

comment on table public.frontier_ecology_events is
  'Append-only audit for governed FRONTIER ecology actions, including frontier and ecology before/after snapshots.';

alter table public.frontier_ecology enable row level security;
alter table public.frontier_ecology_events enable row level security;

revoke all on public.frontier_ecology from anon, authenticated;
revoke all on public.frontier_ecology_events from anon, authenticated;
grant select on public.frontier_ecology to authenticated;
grant select on public.frontier_ecology_events to authenticated;
grant all on public.frontier_ecology to service_role;
grant all on public.frontier_ecology_events to service_role;

drop policy if exists frontier_ecology_read_own on public.frontier_ecology;
create policy frontier_ecology_read_own
  on public.frontier_ecology for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_ecology_events_read on public.frontier_ecology_events;
create policy frontier_ecology_events_read
  on public.frontier_ecology_events for select to authenticated
  using (
    (actor_user_id = (select auth.uid()) and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

create or replace function public.frontier_apply_ecology_action(
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
  v_ecology public.frontier_ecology%rowtype;
  v_existing public.frontier_ecology_events%rowtype;
  v_before_frontier jsonb;
  v_before_ecology jsonb;
  v_after_frontier jsonb;
  v_after_ecology jsonb;
  v_xp integer := 0;
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

  if p_action not in ('collect_seed_pods','cultivate_plot','generate_eco_energy','restore_biome') then
    raise exception 'frontier_unknown_ecology_action' using errcode = '22023';
  end if;

  select * into v_existing
  from public.frontier_ecology_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'ecology_revision', v_existing.resulting_ecology_revision,
      'state', v_existing.resulting_state -> 'state',
      'ecology', v_existing.resulting_state -> 'ecology',
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

  if v_run.campaign_stage < 5 then
    raise exception 'frontier_campaign_gate_living_worlds' using errcode = 'P0001';
  end if;

  insert into public.frontier_ecology (tenant_id, org_id, run_id, actor_user_id)
  values (p_org_id, p_org_id, v_run.id, v_user_id)
  on conflict (org_id, actor_user_id) do nothing;

  select * into v_ecology
  from public.frontier_ecology
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if not found then
    raise exception 'frontier_ecology_unavailable';
  end if;

  -- Re-check after both authoritative rows are locked to close concurrent duplicate races.
  select * into v_existing
  from public.frontier_ecology_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'ecology_revision', v_existing.resulting_ecology_revision,
      'state', v_existing.resulting_state -> 'state',
      'ecology', v_existing.resulting_state -> 'ecology',
      'event_id', v_existing.id
    );
  end if;

  v_before_frontier := jsonb_build_object(
    'aetherium', v_run.aetherium,
    'alloy', v_run.alloy,
    'biofiber', v_run.biofiber,
    'powerCores', v_run.power_cores,
    'habitats', v_run.habitats,
    'skyGridIntegrity', v_run.sky_grid_integrity,
    'actionCount', v_run.action_count,
    'stormMinutes', v_run.storm_minutes,
    'campaignStage', v_run.campaign_stage,
    'experience', v_run.experience,
    'revision', v_run.revision
  );

  v_before_ecology := jsonb_build_object(
    'seedPods', v_ecology.seed_pods,
    'cultivatedPlots', v_ecology.cultivated_plots,
    'ecoEnergy', v_ecology.eco_energy,
    'ecosystemStability', v_ecology.ecosystem_stability,
    'restoredBiomes', v_ecology.restored_biomes,
    'revision', v_ecology.revision
  );

  case p_action
    when 'collect_seed_pods' then
      v_ecology.seed_pods := v_ecology.seed_pods + 2;
      v_xp := 15;

    when 'cultivate_plot' then
      if v_ecology.seed_pods < 2 then
        raise exception 'frontier_insufficient_seed_pods' using errcode = 'P0001';
      end if;
      if v_run.biofiber < 2 then
        raise exception 'frontier_insufficient_biofiber_cultivation' using errcode = 'P0001';
      end if;
      v_ecology.seed_pods := v_ecology.seed_pods - 2;
      v_ecology.cultivated_plots := v_ecology.cultivated_plots + 1;
      v_run.biofiber := v_run.biofiber - 2;
      v_xp := 40;

    when 'generate_eco_energy' then
      if v_ecology.cultivated_plots < 1 then
        raise exception 'frontier_ecology_plot_required' using errcode = 'P0001';
      end if;
      if v_ecology.eco_energy >= 100 then
        raise exception 'frontier_eco_energy_full' using errcode = 'P0001';
      end if;
      v_ecology.eco_energy := least(100, v_ecology.eco_energy + 20);
      v_xp := 25;

    when 'restore_biome' then
      if v_ecology.cultivated_plots < 2 then
        raise exception 'frontier_ecology_two_plots_required' using errcode = 'P0001';
      end if;
      if v_ecology.eco_energy < 40 then
        raise exception 'frontier_insufficient_eco_energy' using errcode = 'P0001';
      end if;
      if v_run.biofiber < 4 then
        raise exception 'frontier_insufficient_biofiber_biome' using errcode = 'P0001';
      end if;
      if v_ecology.ecosystem_stability >= 100 then
        raise exception 'frontier_ecosystem_already_stable' using errcode = 'P0001';
      end if;
      v_ecology.eco_energy := v_ecology.eco_energy - 40;
      v_ecology.ecosystem_stability := least(100, v_ecology.ecosystem_stability + 25);
      v_ecology.restored_biomes := v_ecology.restored_biomes + 1;
      v_run.biofiber := v_run.biofiber - 4;
      v_xp := 150;
  end case;

  if v_run.campaign_stage = 5 and v_ecology.ecosystem_stability >= 25 then
    v_run.campaign_stage := 6;
  end if;

  v_run.experience := v_run.experience + v_xp;
  v_run.action_count := v_run.action_count + 1;
  v_run.storm_minutes := greatest(0, v_run.storm_minutes - 1);
  v_run.revision := v_run.revision + 1;
  v_run.updated_at := now();

  v_ecology.revision := v_ecology.revision + 1;
  v_ecology.updated_at := now();

  update public.frontier_runs set
    biofiber = v_run.biofiber,
    action_count = v_run.action_count,
    storm_minutes = v_run.storm_minutes,
    campaign_stage = v_run.campaign_stage,
    experience = v_run.experience,
    revision = v_run.revision,
    updated_at = v_run.updated_at
  where id = v_run.id;

  update public.frontier_ecology set
    seed_pods = v_ecology.seed_pods,
    cultivated_plots = v_ecology.cultivated_plots,
    eco_energy = v_ecology.eco_energy,
    ecosystem_stability = v_ecology.ecosystem_stability,
    restored_biomes = v_ecology.restored_biomes,
    revision = v_ecology.revision,
    updated_at = v_ecology.updated_at
  where id = v_ecology.id;

  v_after_frontier := jsonb_build_object(
    'aetherium', v_run.aetherium,
    'alloy', v_run.alloy,
    'biofiber', v_run.biofiber,
    'powerCores', v_run.power_cores,
    'habitats', v_run.habitats,
    'skyGridIntegrity', v_run.sky_grid_integrity,
    'actionCount', v_run.action_count,
    'stormMinutes', v_run.storm_minutes,
    'campaignStage', v_run.campaign_stage,
    'experience', v_run.experience,
    'revision', v_run.revision
  );

  v_after_ecology := jsonb_build_object(
    'seedPods', v_ecology.seed_pods,
    'cultivatedPlots', v_ecology.cultivated_plots,
    'ecoEnergy', v_ecology.eco_energy,
    'ecosystemStability', v_ecology.ecosystem_stability,
    'restoredBiomes', v_ecology.restored_biomes,
    'revision', v_ecology.revision
  );

  insert into public.frontier_ecology_events (
    tenant_id, org_id, run_id, ecology_id, actor_user_id, action, idempotency_key,
    previous_run_revision, resulting_run_revision,
    previous_ecology_revision, resulting_ecology_revision,
    before_state, resulting_state
  ) values (
    p_org_id, p_org_id, v_run.id, v_ecology.id, v_user_id, p_action, btrim(p_idempotency_key),
    v_run.revision - 1, v_run.revision,
    v_ecology.revision - 1, v_ecology.revision,
    jsonb_build_object('state', v_before_frontier, 'ecology', v_before_ecology),
    jsonb_build_object('state', v_after_frontier, 'ecology', v_after_ecology)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'revision', v_run.revision,
    'ecology_revision', v_ecology.revision,
    'state', v_after_frontier,
    'ecology', v_after_ecology,
    'event_id', v_event_id
  );
end;
$$;

revoke all on function public.frontier_apply_ecology_action(uuid,text,text)
  from public, anon;
grant execute on function public.frontier_apply_ecology_action(uuid,text,text)
  to authenticated;

comment on function public.frontier_apply_ecology_action(uuid,text,text) is
  'Authenticated ATLAS FRONTIER Living Systems Controller. SECURITY DEFINER is intentional; it validates auth.uid(), organization permissions, campaign gates, resources and idempotency before atomically updating frontier and ecology state.';
