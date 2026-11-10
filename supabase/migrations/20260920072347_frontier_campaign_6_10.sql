-- ATLAS FRONTIER campaign expansion: stages 6-10.
-- Completes the governed 40-level campaign spine while preserving endless Atlas Infinite cycles.

alter table public.frontier_runs
  drop constraint if exists frontier_runs_campaign_stage_check;

alter table public.frontier_runs
  add constraint frontier_runs_campaign_stage_check
  check (campaign_stage between 1 and 10);

create table if not exists public.frontier_expansion (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,

  storm_charge integer not null default 0 check (storm_charge between 0 and 100),
  shelter_integrity integer not null default 0 check (shelter_integrity between 0 and 100),
  storm_mastery integer not null default 0 check (storm_mastery between 0 and 100),

  settlements integer not null default 0 check (settlements >= 0),
  civic_links integer not null default 0 check (civic_links >= 0),
  civilization_index integer not null default 0 check (civilization_index between 0 and 100),

  orbital_frames integer not null default 0 check (orbital_frames >= 0),
  orbital_stations integer not null default 0 check (orbital_stations >= 0),
  orbital_reach integer not null default 0 check (orbital_reach between 0 and 100),

  network_links integer not null default 0 check (network_links >= 0),
  trade_volume integer not null default 0 check (trade_volume between 0 and 100),
  network_integrity integer not null default 0 check (network_integrity between 0 and 100),

  world_seeds integer not null default 0 check (world_seeds >= 0),
  worlds_generated integer not null default 0 check (worlds_generated >= 0),
  infinite_mastery integer not null default 0 check (infinite_mastery between 0 and 100),
  endless_cycles integer not null default 0 check (endless_cycles >= 0),
  campaign_complete boolean not null default false,

  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint frontier_expansion_scope_check check (tenant_id = org_id),
  constraint frontier_expansion_actor_unique unique (org_id, actor_user_id)
);

create table if not exists public.frontier_expansion_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  expansion_id uuid not null references public.frontier_expansion(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null check (action in (
    'capture_storm_charge',
    'reinforce_storm_shelter',
    'master_ion_storm',
    'found_settlement',
    'connect_settlements',
    'establish_civilization',
    'fabricate_orbital_frame',
    'launch_orbital_station',
    'open_orbital_horizon',
    'establish_network_link',
    'run_trade_route',
    'activate_frontier_network',
    'synthesize_world_seed',
    'generate_frontier_world',
    'restore_generated_world'
  )),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  previous_run_revision integer not null check (previous_run_revision >= 0),
  resulting_run_revision integer not null check (resulting_run_revision >= 0),
  previous_expansion_revision integer not null check (previous_expansion_revision >= 0),
  resulting_expansion_revision integer not null check (resulting_expansion_revision >= 0),
  before_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint frontier_expansion_events_scope_check check (tenant_id = org_id),
  constraint frontier_expansion_events_idempotency_unique unique (org_id, actor_user_id, idempotency_key)
);

create index if not exists frontier_expansion_tenant_idx on public.frontier_expansion (tenant_id);
create index if not exists frontier_expansion_run_idx on public.frontier_expansion (run_id);
create index if not exists frontier_expansion_actor_idx on public.frontier_expansion (actor_user_id);
create index if not exists frontier_expansion_events_tenant_idx on public.frontier_expansion_events (tenant_id);
create index if not exists frontier_expansion_events_run_idx on public.frontier_expansion_events (run_id);
create index if not exists frontier_expansion_events_expansion_idx on public.frontier_expansion_events (expansion_id);
create index if not exists frontier_expansion_events_actor_idx on public.frontier_expansion_events (actor_user_id);
create index if not exists frontier_expansion_events_created_idx on public.frontier_expansion_events (org_id, created_at desc);

comment on table public.frontier_expansion is
  'Organization-scoped ATLAS FRONTIER campaign expansion state for stages 6-10 and endless Atlas Infinite cycles. Browser writes are prohibited.';
comment on table public.frontier_expansion_events is
  'Append-only audit for governed FRONTIER campaign expansion actions with run and expansion before/after snapshots.';

alter table public.frontier_expansion enable row level security;
alter table public.frontier_expansion_events enable row level security;

revoke all on public.frontier_expansion from anon, authenticated;
revoke all on public.frontier_expansion_events from anon, authenticated;
grant select on public.frontier_expansion to authenticated;
grant select on public.frontier_expansion_events to authenticated;
grant all on public.frontier_expansion to service_role;
grant all on public.frontier_expansion_events to service_role;

drop policy if exists frontier_expansion_read_own on public.frontier_expansion;
create policy frontier_expansion_read_own
  on public.frontier_expansion for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_expansion_events_read on public.frontier_expansion_events;
create policy frontier_expansion_events_read
  on public.frontier_expansion_events for select to authenticated
  using (
    (actor_user_id = (select auth.uid()) and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

create or replace function public.frontier_apply_expansion_action(
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
  v_expansion public.frontier_expansion%rowtype;
  v_existing public.frontier_expansion_events%rowtype;
  v_before_run jsonb;
  v_before_expansion jsonb;
  v_after_run jsonb;
  v_after_expansion jsonb;
  v_xp integer := 0;
  v_required_stage integer;
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

  v_required_stage := case p_action
    when 'capture_storm_charge' then 6
    when 'reinforce_storm_shelter' then 6
    when 'master_ion_storm' then 6
    when 'found_settlement' then 7
    when 'connect_settlements' then 7
    when 'establish_civilization' then 7
    when 'fabricate_orbital_frame' then 8
    when 'launch_orbital_station' then 8
    when 'open_orbital_horizon' then 8
    when 'establish_network_link' then 9
    when 'run_trade_route' then 9
    when 'activate_frontier_network' then 9
    when 'synthesize_world_seed' then 10
    when 'generate_frontier_world' then 10
    when 'restore_generated_world' then 10
    else null
  end;

  if v_required_stage is null then
    raise exception 'frontier_unknown_expansion_action' using errcode = '22023';
  end if;

  select * into v_existing
  from public.frontier_expansion_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'expansion_revision', v_existing.resulting_expansion_revision,
      'state', v_existing.resulting_state -> 'state',
      'expansion', v_existing.resulting_state -> 'expansion',
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

  if v_run.campaign_stage <> v_required_stage then
    raise exception 'frontier_expansion_stage_mismatch' using errcode = 'P0001';
  end if;

  insert into public.frontier_expansion (tenant_id, org_id, run_id, actor_user_id)
  values (p_org_id, p_org_id, v_run.id, v_user_id)
  on conflict (org_id, actor_user_id) do nothing;

  select * into v_expansion
  from public.frontier_expansion
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if not found then
    raise exception 'frontier_expansion_unavailable';
  end if;

  -- Re-check idempotency after authoritative row locks.
  select * into v_existing
  from public.frontier_expansion_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'expansion_revision', v_existing.resulting_expansion_revision,
      'state', v_existing.resulting_state -> 'state',
      'expansion', v_existing.resulting_state -> 'expansion',
      'event_id', v_existing.id
    );
  end if;

  v_before_run := jsonb_build_object(
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

  v_before_expansion := jsonb_build_object(
    'stormCharge', v_expansion.storm_charge,
    'shelterIntegrity', v_expansion.shelter_integrity,
    'stormMastery', v_expansion.storm_mastery,
    'settlements', v_expansion.settlements,
    'civicLinks', v_expansion.civic_links,
    'civilizationIndex', v_expansion.civilization_index,
    'orbitalFrames', v_expansion.orbital_frames,
    'orbitalStations', v_expansion.orbital_stations,
    'orbitalReach', v_expansion.orbital_reach,
    'networkLinks', v_expansion.network_links,
    'tradeVolume', v_expansion.trade_volume,
    'networkIntegrity', v_expansion.network_integrity,
    'worldSeeds', v_expansion.world_seeds,
    'worldsGenerated', v_expansion.worlds_generated,
    'infiniteMastery', v_expansion.infinite_mastery,
    'endlessCycles', v_expansion.endless_cycles,
    'campaignComplete', v_expansion.campaign_complete,
    'revision', v_expansion.revision
  );

  case p_action
    when 'capture_storm_charge' then
      if v_expansion.storm_charge >= 100 then raise exception 'frontier_storm_charge_full' using errcode = 'P0001'; end if;
      v_expansion.storm_charge := least(100, v_expansion.storm_charge + 25);
      v_xp := 20;

    when 'reinforce_storm_shelter' then
      if v_expansion.shelter_integrity >= 100 then raise exception 'frontier_shelter_fully_reinforced' using errcode = 'P0001'; end if;
      if v_run.alloy < 8 or v_run.biofiber < 4 then raise exception 'frontier_insufficient_storm_materials' using errcode = 'P0001'; end if;
      v_run.alloy := v_run.alloy - 8;
      v_run.biofiber := v_run.biofiber - 4;
      v_expansion.shelter_integrity := least(100, v_expansion.shelter_integrity + 25);
      v_xp := 40;

    when 'master_ion_storm' then
      if v_expansion.storm_charge < 50 then raise exception 'frontier_insufficient_storm_charge' using errcode = 'P0001'; end if;
      if v_expansion.shelter_integrity < 50 then raise exception 'frontier_insufficient_shelter_integrity' using errcode = 'P0001'; end if;
      v_expansion.storm_charge := v_expansion.storm_charge - 50;
      v_expansion.storm_mastery := least(100, v_expansion.storm_mastery + 25);
      v_run.campaign_stage := 7;
      v_xp := 100;

    when 'found_settlement' then
      if v_run.alloy < 16 or v_run.biofiber < 8 then raise exception 'frontier_insufficient_settlement_materials' using errcode = 'P0001'; end if;
      v_run.alloy := v_run.alloy - 16;
      v_run.biofiber := v_run.biofiber - 8;
      v_expansion.settlements := v_expansion.settlements + 1;
      v_xp := 100;

    when 'connect_settlements' then
      if v_expansion.settlements < 2 then raise exception 'frontier_two_settlements_required' using errcode = 'P0001'; end if;
      v_expansion.civic_links := v_expansion.civic_links + 1;
      v_xp := 75;

    when 'establish_civilization' then
      if v_expansion.settlements < 2 or v_expansion.civic_links < 1 then raise exception 'frontier_civilization_requirements_unmet' using errcode = 'P0001'; end if;
      v_expansion.civilization_index := least(100, v_expansion.civilization_index + 25);
      v_run.campaign_stage := 8;
      v_xp := 150;

    when 'fabricate_orbital_frame' then
      if v_run.aetherium < 16 or v_run.alloy < 24 then raise exception 'frontier_insufficient_orbital_materials' using errcode = 'P0001'; end if;
      v_run.aetherium := v_run.aetherium - 16;
      v_run.alloy := v_run.alloy - 24;
      v_expansion.orbital_frames := v_expansion.orbital_frames + 1;
      v_xp := 120;

    when 'launch_orbital_station' then
      if v_expansion.orbital_frames < 1 then raise exception 'frontier_orbital_frame_required' using errcode = 'P0001'; end if;
      if v_run.power_cores < 1 then raise exception 'frontier_power_core_required_orbit' using errcode = 'P0001'; end if;
      v_expansion.orbital_frames := v_expansion.orbital_frames - 1;
      v_expansion.orbital_stations := v_expansion.orbital_stations + 1;
      v_run.power_cores := v_run.power_cores - 1;
      v_xp := 180;

    when 'open_orbital_horizon' then
      if v_expansion.orbital_stations < 1 then raise exception 'frontier_orbital_station_required' using errcode = 'P0001'; end if;
      v_expansion.orbital_reach := least(100, v_expansion.orbital_reach + 25);
      v_run.campaign_stage := 9;
      v_xp := 200;

    when 'establish_network_link' then
      if v_run.aetherium < 8 or v_run.alloy < 8 then raise exception 'frontier_insufficient_network_materials' using errcode = 'P0001'; end if;
      v_run.aetherium := v_run.aetherium - 8;
      v_run.alloy := v_run.alloy - 8;
      v_expansion.network_links := v_expansion.network_links + 1;
      v_xp := 100;

    when 'run_trade_route' then
      if v_expansion.network_links < 2 then raise exception 'frontier_two_network_links_required' using errcode = 'P0001'; end if;
      if v_expansion.trade_volume >= 100 then raise exception 'frontier_trade_volume_full' using errcode = 'P0001'; end if;
      v_expansion.trade_volume := least(100, v_expansion.trade_volume + 25);
      v_xp := 90;

    when 'activate_frontier_network' then
      if v_expansion.network_links < 2 or v_expansion.trade_volume < 50 then raise exception 'frontier_network_requirements_unmet' using errcode = 'P0001'; end if;
      v_expansion.network_integrity := least(100, v_expansion.network_integrity + 25);
      v_run.campaign_stage := 10;
      v_xp := 250;

    when 'synthesize_world_seed' then
      if v_run.aetherium < 20 or v_run.biofiber < 6 then raise exception 'frontier_insufficient_world_seed_materials' using errcode = 'P0001'; end if;
      v_run.aetherium := v_run.aetherium - 20;
      v_run.biofiber := v_run.biofiber - 6;
      v_expansion.world_seeds := v_expansion.world_seeds + 1;
      v_xp := 200;

    when 'generate_frontier_world' then
      if v_expansion.world_seeds < 1 then raise exception 'frontier_world_seed_required' using errcode = 'P0001'; end if;
      v_expansion.world_seeds := v_expansion.world_seeds - 1;
      v_expansion.worlds_generated := v_expansion.worlds_generated + 1;
      v_xp := 250;

    when 'restore_generated_world' then
      if v_expansion.worlds_generated <= v_expansion.endless_cycles then raise exception 'frontier_generated_world_required' using errcode = 'P0001'; end if;
      v_expansion.infinite_mastery := least(100, v_expansion.infinite_mastery + 25);
      v_expansion.endless_cycles := v_expansion.endless_cycles + 1;
      v_expansion.campaign_complete := true;
      v_xp := 500;
  end case;

  v_run.experience := v_run.experience + v_xp;
  v_run.action_count := v_run.action_count + 1;
  v_run.storm_minutes := greatest(0, v_run.storm_minutes - 1);
  v_run.revision := v_run.revision + 1;
  v_run.updated_at := now();

  v_expansion.revision := v_expansion.revision + 1;
  v_expansion.updated_at := now();

  update public.frontier_runs set
    aetherium = v_run.aetherium,
    alloy = v_run.alloy,
    biofiber = v_run.biofiber,
    power_cores = v_run.power_cores,
    action_count = v_run.action_count,
    storm_minutes = v_run.storm_minutes,
    campaign_stage = v_run.campaign_stage,
    experience = v_run.experience,
    revision = v_run.revision,
    updated_at = v_run.updated_at
  where id = v_run.id;

  update public.frontier_expansion set
    storm_charge = v_expansion.storm_charge,
    shelter_integrity = v_expansion.shelter_integrity,
    storm_mastery = v_expansion.storm_mastery,
    settlements = v_expansion.settlements,
    civic_links = v_expansion.civic_links,
    civilization_index = v_expansion.civilization_index,
    orbital_frames = v_expansion.orbital_frames,
    orbital_stations = v_expansion.orbital_stations,
    orbital_reach = v_expansion.orbital_reach,
    network_links = v_expansion.network_links,
    trade_volume = v_expansion.trade_volume,
    network_integrity = v_expansion.network_integrity,
    world_seeds = v_expansion.world_seeds,
    worlds_generated = v_expansion.worlds_generated,
    infinite_mastery = v_expansion.infinite_mastery,
    endless_cycles = v_expansion.endless_cycles,
    campaign_complete = v_expansion.campaign_complete,
    revision = v_expansion.revision,
    updated_at = v_expansion.updated_at
  where id = v_expansion.id;

  v_after_run := jsonb_build_object(
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

  v_after_expansion := jsonb_build_object(
    'stormCharge', v_expansion.storm_charge,
    'shelterIntegrity', v_expansion.shelter_integrity,
    'stormMastery', v_expansion.storm_mastery,
    'settlements', v_expansion.settlements,
    'civicLinks', v_expansion.civic_links,
    'civilizationIndex', v_expansion.civilization_index,
    'orbitalFrames', v_expansion.orbital_frames,
    'orbitalStations', v_expansion.orbital_stations,
    'orbitalReach', v_expansion.orbital_reach,
    'networkLinks', v_expansion.network_links,
    'tradeVolume', v_expansion.trade_volume,
    'networkIntegrity', v_expansion.network_integrity,
    'worldSeeds', v_expansion.world_seeds,
    'worldsGenerated', v_expansion.worlds_generated,
    'infiniteMastery', v_expansion.infinite_mastery,
    'endlessCycles', v_expansion.endless_cycles,
    'campaignComplete', v_expansion.campaign_complete,
    'revision', v_expansion.revision
  );

  insert into public.frontier_expansion_events (
    tenant_id, org_id, run_id, expansion_id, actor_user_id, action, idempotency_key,
    previous_run_revision, resulting_run_revision,
    previous_expansion_revision, resulting_expansion_revision,
    before_state, resulting_state
  ) values (
    p_org_id, p_org_id, v_run.id, v_expansion.id, v_user_id, p_action, btrim(p_idempotency_key),
    v_run.revision - 1, v_run.revision,
    v_expansion.revision - 1, v_expansion.revision,
    jsonb_build_object('state', v_before_run, 'expansion', v_before_expansion),
    jsonb_build_object('state', v_after_run, 'expansion', v_after_expansion)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'revision', v_run.revision,
    'expansion_revision', v_expansion.revision,
    'state', v_after_run,
    'expansion', v_after_expansion,
    'event_id', v_event_id
  );
end;
$$;

revoke all on function public.frontier_apply_expansion_action(uuid,text,text)
  from public, anon;
grant execute on function public.frontier_apply_expansion_action(uuid,text,text)
  to authenticated;

comment on function public.frontier_apply_expansion_action(uuid,text,text) is
  'Authenticated ATLAS FRONTIER server-authoritative campaign expansion controller for stages 6-10 and endless mode. Validates auth.uid(), organization permissions, exact stage, resource costs, progression and idempotency before atomic writes.';
