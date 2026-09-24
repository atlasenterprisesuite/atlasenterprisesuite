-- ATLAS FRONTIER survival and dynamic environmental hazards.
-- Server-selected hazards, transactional survival actions and append-only audit.

create table if not exists public.frontier_survival (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  health integer not null default 100 check (health between 0 and 100),
  suit_energy integer not null default 100 check (suit_energy between 0 and 100),
  shield_integrity integer not null default 0 check (shield_integrity between 0 and 100),
  thermal_stability integer not null default 50 check (thermal_stability between 0 and 100),
  exposure integer not null default 0 check (exposure between 0 and 100),
  active_hazard text not null default 'clear' check (active_hazard in ('clear','ion_storm','thermal_front','anomaly')),
  hazard_intensity integer not null default 0 check (hazard_intensity between 0 and 100),
  hazard_turns integer not null default 0 check (hazard_turns between 0 and 10),
  survived_events integer not null default 0 check (survived_events >= 0),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frontier_survival_scope_check check (tenant_id = org_id),
  constraint frontier_survival_actor_unique unique (org_id, actor_user_id)
);

create table if not exists public.frontier_survival_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  survival_id uuid not null references public.frontier_survival(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action text not null check (action in (
    'scan_environment','recharge_suit','deploy_shield','stabilize_temperature','endure_hazard','recover_at_habitat'
  )),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  previous_run_revision integer not null check (previous_run_revision >= 0),
  resulting_run_revision integer not null check (resulting_run_revision >= 0),
  previous_survival_revision integer not null check (previous_survival_revision >= 0),
  resulting_survival_revision integer not null check (resulting_survival_revision >= 0),
  before_state jsonb not null,
  resulting_state jsonb not null,
  created_at timestamptz not null default now(),
  constraint frontier_survival_events_scope_check check (tenant_id = org_id),
  constraint frontier_survival_events_idempotency_unique unique (org_id, actor_user_id, idempotency_key)
);

create index if not exists frontier_survival_tenant_idx on public.frontier_survival (tenant_id);
create index if not exists frontier_survival_run_idx on public.frontier_survival (run_id);
create index if not exists frontier_survival_actor_idx on public.frontier_survival (actor_user_id);
create index if not exists frontier_survival_events_tenant_idx on public.frontier_survival_events (tenant_id);
create index if not exists frontier_survival_events_run_idx on public.frontier_survival_events (run_id);
create index if not exists frontier_survival_events_survival_idx on public.frontier_survival_events (survival_id);
create index if not exists frontier_survival_events_actor_idx on public.frontier_survival_events (actor_user_id);
create index if not exists frontier_survival_events_created_idx on public.frontier_survival_events (org_id, created_at desc);

comment on table public.frontier_survival is
  'Organization-scoped FRONTIER survival state. Hazards and survival mutations are server-authoritative; browser writes are prohibited.';
comment on table public.frontier_survival_events is
  'Append-only survival audit containing run and survival before/after state for every committed action.';

alter table public.frontier_survival enable row level security;
alter table public.frontier_survival_events enable row level security;

revoke all on public.frontier_survival from anon, authenticated;
revoke all on public.frontier_survival_events from anon, authenticated;
grant select on public.frontier_survival to authenticated;
grant select on public.frontier_survival_events to authenticated;
grant all on public.frontier_survival to service_role;
grant all on public.frontier_survival_events to service_role;

drop policy if exists frontier_survival_read_own on public.frontier_survival;
create policy frontier_survival_read_own
  on public.frontier_survival for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_survival_events_read on public.frontier_survival_events;
create policy frontier_survival_events_read
  on public.frontier_survival_events for select to authenticated
  using (
    (actor_user_id = (select auth.uid()) and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

create or replace function public.frontier_apply_survival_action(
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
  v_survival public.frontier_survival%rowtype;
  v_existing public.frontier_survival_events%rowtype;
  v_before_run jsonb;
  v_before_survival jsonb;
  v_after_run jsonb;
  v_after_survival jsonb;
  v_selector integer;
  v_protection integer;
  v_damage integer;
  v_exposure_gain integer;
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

  if p_action not in ('scan_environment','recharge_suit','deploy_shield','stabilize_temperature','endure_hazard','recover_at_habitat') then
    raise exception 'frontier_unknown_survival_action' using errcode = '22023';
  end if;

  select * into v_existing
  from public.frontier_survival_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'survival_revision', v_existing.resulting_survival_revision,
      'state', v_existing.resulting_state -> 'state',
      'survival', v_existing.resulting_state -> 'survival',
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

  insert into public.frontier_survival (tenant_id, org_id, run_id, actor_user_id)
  values (p_org_id, p_org_id, v_run.id, v_user_id)
  on conflict (org_id, actor_user_id) do nothing;

  select * into v_survival
  from public.frontier_survival
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if not found then
    raise exception 'frontier_survival_unavailable';
  end if;

  select * into v_existing
  from public.frontier_survival_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_run_revision,
      'survival_revision', v_existing.resulting_survival_revision,
      'state', v_existing.resulting_state -> 'state',
      'survival', v_existing.resulting_state -> 'survival',
      'event_id', v_existing.id
    );
  end if;

  v_before_run := jsonb_build_object(
    'aetherium',v_run.aetherium,'alloy',v_run.alloy,'biofiber',v_run.biofiber,
    'powerCores',v_run.power_cores,'habitats',v_run.habitats,
    'skyGridIntegrity',v_run.sky_grid_integrity,'actionCount',v_run.action_count,
    'stormMinutes',v_run.storm_minutes,'campaignStage',v_run.campaign_stage,
    'experience',v_run.experience,'revision',v_run.revision
  );

  v_before_survival := jsonb_build_object(
    'health',v_survival.health,'suitEnergy',v_survival.suit_energy,
    'shieldIntegrity',v_survival.shield_integrity,'thermalStability',v_survival.thermal_stability,
    'exposure',v_survival.exposure,'activeHazard',v_survival.active_hazard,
    'hazardIntensity',v_survival.hazard_intensity,'hazardTurns',v_survival.hazard_turns,
    'survivedEvents',v_survival.survived_events,'revision',v_survival.revision
  );

  case p_action
    when 'scan_environment' then
      if v_survival.active_hazard <> 'clear' or v_survival.hazard_turns > 0 then
        raise exception 'frontier_hazard_already_active' using errcode = 'P0001';
      end if;
      if v_survival.suit_energy < 5 then
        raise exception 'frontier_insufficient_suit_energy_scan' using errcode = 'P0001';
      end if;
      v_survival.suit_energy := v_survival.suit_energy - 5;
      v_selector := mod(v_run.action_count + v_survival.revision, 3);
      v_survival.active_hazard := case v_selector
        when 0 then 'ion_storm'
        when 1 then 'thermal_front'
        else 'anomaly'
      end;
      v_survival.hazard_intensity := case v_selector
        when 0 then 55
        when 1 then 60
        else 70
      end;
      v_survival.hazard_turns := 3;
      v_xp := 10;

    when 'recharge_suit' then
      if v_run.aetherium < 4 then raise exception 'frontier_insufficient_aetherium_recharge' using errcode = 'P0001'; end if;
      if v_survival.suit_energy >= 100 then raise exception 'frontier_suit_energy_full' using errcode = 'P0001'; end if;
      v_run.aetherium := v_run.aetherium - 4;
      v_survival.suit_energy := least(100, v_survival.suit_energy + 25);
      v_xp := 15;

    when 'deploy_shield' then
      if v_survival.suit_energy < 10 then raise exception 'frontier_insufficient_suit_energy_shield' using errcode = 'P0001'; end if;
      if v_survival.shield_integrity >= 100 then raise exception 'frontier_shield_full' using errcode = 'P0001'; end if;
      v_survival.suit_energy := v_survival.suit_energy - 10;
      v_survival.shield_integrity := least(100, v_survival.shield_integrity + 25);
      v_xp := 20;

    when 'stabilize_temperature' then
      if v_survival.suit_energy < 10 then raise exception 'frontier_insufficient_suit_energy_thermal' using errcode = 'P0001'; end if;
      if v_survival.thermal_stability >= 100 then raise exception 'frontier_thermal_stability_full' using errcode = 'P0001'; end if;
      v_survival.suit_energy := v_survival.suit_energy - 10;
      v_survival.thermal_stability := least(100, v_survival.thermal_stability + 25);
      v_xp := 20;

    when 'endure_hazard' then
      if v_survival.active_hazard = 'clear' or v_survival.hazard_turns < 1 then
        raise exception 'frontier_no_active_hazard' using errcode = 'P0001';
      end if;
      if v_survival.health <= 0 then raise exception 'frontier_recovery_required' using errcode = 'P0001'; end if;
      if v_survival.suit_energy < 5 then raise exception 'frontier_insufficient_suit_energy_hazard' using errcode = 'P0001'; end if;

      v_survival.suit_energy := v_survival.suit_energy - 5;
      v_protection := case v_survival.active_hazard
        when 'ion_storm' then v_survival.shield_integrity
        when 'thermal_front' then v_survival.thermal_stability
        else floor((v_survival.shield_integrity + v_survival.thermal_stability) / 2.0)::integer
      end;
      v_damage := greatest(0, ceil(greatest(0, v_survival.hazard_intensity - v_protection) / 5.0)::integer);
      v_exposure_gain := greatest(0, ceil(greatest(0, v_survival.hazard_intensity - v_protection) / 10.0)::integer);

      v_survival.health := greatest(0, v_survival.health - v_damage);
      v_survival.exposure := least(100, v_survival.exposure + v_exposure_gain);

      if v_survival.active_hazard in ('ion_storm','anomaly') then
        v_survival.shield_integrity := greatest(0, v_survival.shield_integrity - 10);
      end if;
      if v_survival.active_hazard in ('thermal_front','anomaly') then
        v_survival.thermal_stability := greatest(0, v_survival.thermal_stability - 10);
      end if;

      v_survival.hazard_turns := v_survival.hazard_turns - 1;
      if v_survival.hazard_turns = 0 then
        v_survival.active_hazard := 'clear';
        v_survival.hazard_intensity := 0;
        if v_survival.health > 0 then
          v_survival.survived_events := v_survival.survived_events + 1;
        end if;
      end if;
      v_xp := 60;

    when 'recover_at_habitat' then
      if v_run.habitats < 1 then raise exception 'frontier_habitat_required_recovery' using errcode = 'P0001'; end if;
      if v_run.biofiber < 4 then raise exception 'frontier_insufficient_biofiber_recovery' using errcode = 'P0001'; end if;
      if v_survival.health >= 100 and v_survival.exposure = 0 then raise exception 'frontier_recovery_not_required' using errcode = 'P0001'; end if;
      v_run.biofiber := v_run.biofiber - 4;
      v_survival.health := 100;
      v_survival.exposure := 0;
      v_survival.suit_energy := greatest(v_survival.suit_energy, 50);
      v_survival.thermal_stability := greatest(v_survival.thermal_stability, 50);
      v_xp := 20;
  end case;

  v_run.experience := v_run.experience + v_xp;
  v_run.action_count := v_run.action_count + 1;
  v_run.revision := v_run.revision + 1;
  v_run.updated_at := now();

  v_survival.revision := v_survival.revision + 1;
  v_survival.updated_at := now();

  update public.frontier_runs set
    aetherium = v_run.aetherium,
    biofiber = v_run.biofiber,
    action_count = v_run.action_count,
    experience = v_run.experience,
    revision = v_run.revision,
    updated_at = v_run.updated_at
  where id = v_run.id;

  update public.frontier_survival set
    health = v_survival.health,
    suit_energy = v_survival.suit_energy,
    shield_integrity = v_survival.shield_integrity,
    thermal_stability = v_survival.thermal_stability,
    exposure = v_survival.exposure,
    active_hazard = v_survival.active_hazard,
    hazard_intensity = v_survival.hazard_intensity,
    hazard_turns = v_survival.hazard_turns,
    survived_events = v_survival.survived_events,
    revision = v_survival.revision,
    updated_at = v_survival.updated_at
  where id = v_survival.id;

  v_after_run := jsonb_build_object(
    'aetherium',v_run.aetherium,'alloy',v_run.alloy,'biofiber',v_run.biofiber,
    'powerCores',v_run.power_cores,'habitats',v_run.habitats,
    'skyGridIntegrity',v_run.sky_grid_integrity,'actionCount',v_run.action_count,
    'stormMinutes',v_run.storm_minutes,'campaignStage',v_run.campaign_stage,
    'experience',v_run.experience,'revision',v_run.revision
  );

  v_after_survival := jsonb_build_object(
    'health',v_survival.health,'suitEnergy',v_survival.suit_energy,
    'shieldIntegrity',v_survival.shield_integrity,'thermalStability',v_survival.thermal_stability,
    'exposure',v_survival.exposure,'activeHazard',v_survival.active_hazard,
    'hazardIntensity',v_survival.hazard_intensity,'hazardTurns',v_survival.hazard_turns,
    'survivedEvents',v_survival.survived_events,'revision',v_survival.revision
  );

  insert into public.frontier_survival_events (
    tenant_id,org_id,run_id,survival_id,actor_user_id,action,idempotency_key,
    previous_run_revision,resulting_run_revision,
    previous_survival_revision,resulting_survival_revision,
    before_state,resulting_state
  ) values (
    p_org_id,p_org_id,v_run.id,v_survival.id,v_user_id,p_action,btrim(p_idempotency_key),
    v_run.revision-1,v_run.revision,
    v_survival.revision-1,v_survival.revision,
    jsonb_build_object('state',v_before_run,'survival',v_before_survival),
    jsonb_build_object('state',v_after_run,'survival',v_after_survival)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'revision',v_run.revision,
    'survival_revision',v_survival.revision,
    'state',v_after_run,
    'survival',v_after_survival,
    'event_id',v_event_id
  );
end;
$$;

revoke all on function public.frontier_apply_survival_action(uuid,text,text)
  from public, anon;
grant execute on function public.frontier_apply_survival_action(uuid,text,text)
  to authenticated;

comment on function public.frontier_apply_survival_action(uuid,text,text) is
  'Authenticated ATLAS FRONTIER survival controller. Server selects hazards deterministically from audited state and validates permissions, resources, protection, damage, recovery and idempotency before atomic writes.';
