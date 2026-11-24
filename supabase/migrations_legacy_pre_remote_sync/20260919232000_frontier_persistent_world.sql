-- ATLAS FRONTIER persistent spatial world.
-- Adds durable governed structures without weakening the existing server-authoritative Flow Controller.

alter table public.frontier_events
  add column if not exists world_delta jsonb not null default '{}'::jsonb;

create table if not exists public.frontier_structures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_event_id uuid unique references public.frontier_events(id) on delete set null,
  structure_type text not null check (structure_type in ('habitat')),
  position_x double precision not null check (position_x between -6.5 and 6.5),
  position_y double precision not null default 0 check (position_y between -0.25 and 1.5),
  position_z double precision not null check (position_z between -6.5 and 6.5),
  rotation_y double precision not null default 0 check (rotation_y between -3.141592653589793 and 3.141592653589793),
  run_revision integer not null default 0 check (run_revision >= 0),
  placement_origin text not null default 'governed' check (placement_origin in ('governed','legacy_default','legacy_backfill')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint frontier_structures_scope_check check (tenant_id = org_id),
  constraint frontier_structures_idempotency_key_check check (
    idempotency_key is null or char_length(btrim(idempotency_key)) between 8 and 160
  )
);

create index if not exists frontier_structures_org_actor_idx
  on public.frontier_structures (org_id, actor_user_id, created_at);

create unique index if not exists frontier_structures_idempotency_unique
  on public.frontier_structures (org_id, actor_user_id, idempotency_key)
  where idempotency_key is not null;

comment on table public.frontier_structures is
  'Durable organization-scoped ATLAS FRONTIER world structures. Browser writes are prohibited; spatial placement is committed only through governed server functions.';

alter table public.frontier_structures enable row level security;

revoke all on public.frontier_structures from anon, authenticated;
grant select on public.frontier_structures to authenticated;
grant all on public.frontier_structures to service_role;

drop policy if exists frontier_structures_read_own on public.frontier_structures;
create policy frontier_structures_read_own
  on public.frontier_structures for select to authenticated
  using (
    actor_user_id = auth.uid()
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

-- Existing Habitats never had spatial coordinates. Give them deterministic,
-- visibly-labelled legacy positions once so subsequent sessions are stable.
insert into public.frontier_structures (
  tenant_id, org_id, run_id, actor_user_id, structure_type,
  position_x, position_y, position_z, rotation_y, run_revision, placement_origin
)
select
  r.tenant_id,
  r.org_id,
  r.id,
  r.actor_user_id,
  'habitat',
  (-6 + (mod(g.n - 1, 7) * 2))::double precision,
  0::double precision,
  (-6 + (mod(((g.n - 1) / 7), 7) * 2))::double precision,
  0::double precision,
  r.revision,
  'legacy_backfill'
from public.frontier_runs r
cross join lateral (
  select count(*)::integer as existing_count
  from public.frontier_structures s
  where s.run_id = r.id and s.structure_type = 'habitat'
) c
cross join lateral generate_series(c.existing_count + 1, r.habitats) as g(n)
where r.habitats > c.existing_count;

create or replace function public.frontier_persist_legacy_habitat_position()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing integer;
  v_i integer;
begin
  if new.habitats <= old.habitats then
    return new;
  end if;

  -- New spatial RPC sets this transaction-local flag because it inserts
  -- the exact chosen coordinates itself.
  if coalesce(current_setting('atlas.frontier_spatial_build', true), '') = '1' then
    return new;
  end if;

  select count(*)::integer into v_existing
  from public.frontier_structures
  where run_id = new.id and structure_type = 'habitat';

  if v_existing < new.habitats then
    for v_i in (v_existing + 1)..new.habitats loop
      insert into public.frontier_structures (
        tenant_id, org_id, run_id, actor_user_id, structure_type,
        position_x, position_y, position_z, rotation_y, run_revision, placement_origin
      ) values (
        new.tenant_id,
        new.org_id,
        new.id,
        new.actor_user_id,
        'habitat',
        (-6 + (mod(v_i - 1, 7) * 2))::double precision,
        0::double precision,
        (-6 + (mod(((v_i - 1) / 7), 7) * 2))::double precision,
        0::double precision,
        new.revision,
        'legacy_default'
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists frontier_runs_persist_legacy_habitat_position on public.frontier_runs;
create trigger frontier_runs_persist_legacy_habitat_position
after update of habitats on public.frontier_runs
for each row
when (new.habitats > old.habitats)
execute function public.frontier_persist_legacy_habitat_position();

create or replace function public.frontier_build_structure(
  p_org_id uuid,
  p_structure_type text,
  p_idempotency_key text,
  p_position_x double precision,
  p_position_y double precision,
  p_position_z double precision,
  p_rotation_y double precision
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
  v_structure public.frontier_structures%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_world_delta jsonb;
  v_event_id uuid;
  v_rotation double precision;
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

  if lower(btrim(coalesce(p_structure_type, ''))) <> 'habitat' then
    raise exception 'frontier_unknown_structure' using errcode = '22023';
  end if;

  if p_position_x is null or p_position_y is null or p_position_z is null or p_rotation_y is null
     or p_position_x::text in ('NaN','Infinity','-Infinity')
     or p_position_y::text in ('NaN','Infinity','-Infinity')
     or p_position_z::text in ('NaN','Infinity','-Infinity')
     or p_rotation_y::text in ('NaN','Infinity','-Infinity') then
    raise exception 'frontier_invalid_structure_transform' using errcode = '22023';
  end if;

  if p_position_x not between -6.5 and 6.5
     or p_position_y not between -0.25 and 1.5
     or p_position_z not between -6.5 and 6.5 then
    raise exception 'frontier_structure_out_of_bounds' using errcode = '22023';
  end if;

  v_rotation := atan2(sin(p_rotation_y), cos(p_rotation_y));

  select * into v_existing
  from public.frontier_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing.action <> 'build_habitat' then
      raise exception 'frontier_idempotency_conflict' using errcode = '23505';
    end if;

    select * into v_structure
    from public.frontier_structures
    where source_event_id = v_existing.id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_revision,
      'state', v_existing.resulting_state,
      'event_id', v_existing.id,
      'structure', case when v_structure.id is null then null else jsonb_build_object(
        'id', v_structure.id,
        'structureType', v_structure.structure_type,
        'position', jsonb_build_object('x',v_structure.position_x,'y',v_structure.position_y,'z',v_structure.position_z),
        'rotationY', v_structure.rotation_y,
        'runRevision', v_structure.run_revision,
        'placementOrigin', v_structure.placement_origin
      ) end
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

  -- Re-check idempotency after the run lock to close concurrent duplicate races.
  select * into v_existing
  from public.frontier_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing.action <> 'build_habitat' then
      raise exception 'frontier_idempotency_conflict' using errcode = '23505';
    end if;

    select * into v_structure
    from public.frontier_structures
    where source_event_id = v_existing.id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'revision', v_existing.resulting_revision,
      'state', v_existing.resulting_state,
      'event_id', v_existing.id,
      'structure', case when v_structure.id is null then null else jsonb_build_object(
        'id', v_structure.id,
        'structureType', v_structure.structure_type,
        'position', jsonb_build_object('x',v_structure.position_x,'y',v_structure.position_y,'z',v_structure.position_z),
        'rotationY', v_structure.rotation_y,
        'runRevision', v_structure.run_revision,
        'placementOrigin', v_structure.placement_origin
      ) end
    );
  end if;

  if v_run.campaign_stage < 2 then
    raise exception 'frontier_campaign_gate_habitat' using errcode = 'P0001';
  end if;

  if v_run.alloy < 12 or v_run.biofiber < 8 then
    raise exception 'frontier_insufficient_resources_habitat' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.frontier_structures s
    where s.run_id = v_run.id
      and sqrt(power(s.position_x - p_position_x, 2) + power(s.position_z - p_position_z, 2)) < 1.8
  ) then
    raise exception 'frontier_structure_collision' using errcode = 'P0001';
  end if;

  if sqrt(power(p_position_x - (-3.2), 2) + power(p_position_z - (-1.2), 2)) < 1.45
     or sqrt(power(p_position_x - 3.4, 2) + power(p_position_z - 1.8, 2)) < 1.45
     or sqrt(power(p_position_x - (-1.2), 2) + power(p_position_z - 4.6, 2)) < 1.45 then
    raise exception 'frontier_structure_blocks_resource_node' using errcode = 'P0001';
  end if;

  v_before := jsonb_build_object(
    'aetherium',v_run.aetherium,
    'alloy',v_run.alloy,
    'biofiber',v_run.biofiber,
    'powerCores',v_run.power_cores,
    'habitats',v_run.habitats,
    'skyGridIntegrity',v_run.sky_grid_integrity,
    'actionCount',v_run.action_count,
    'stormMinutes',v_run.storm_minutes,
    'campaignStage',v_run.campaign_stage,
    'experience',v_run.experience
  );

  v_run.alloy := v_run.alloy - 12;
  v_run.biofiber := v_run.biofiber - 8;
  v_run.habitats := v_run.habitats + 1;

  if v_run.campaign_stage = 2 and v_run.habitats >= 1 then
    v_run.campaign_stage := 3;
  end if;

  v_run.experience := v_run.experience + 80;
  v_run.action_count := v_run.action_count + 1;
  v_run.storm_minutes := greatest(0, v_run.storm_minutes - 1);
  v_run.revision := v_run.revision + 1;
  v_run.updated_at := now();

  -- Prevent the compatibility trigger from fabricating a default location.
  perform set_config('atlas.frontier_spatial_build', '1', true);

  update public.frontier_runs set
    alloy = v_run.alloy,
    biofiber = v_run.biofiber,
    habitats = v_run.habitats,
    action_count = v_run.action_count,
    storm_minutes = v_run.storm_minutes,
    campaign_stage = v_run.campaign_stage,
    experience = v_run.experience,
    revision = v_run.revision,
    updated_at = v_run.updated_at
  where id = v_run.id;

  v_after := jsonb_build_object(
    'aetherium',v_run.aetherium,
    'alloy',v_run.alloy,
    'biofiber',v_run.biofiber,
    'powerCores',v_run.power_cores,
    'habitats',v_run.habitats,
    'skyGridIntegrity',v_run.sky_grid_integrity,
    'actionCount',v_run.action_count,
    'stormMinutes',v_run.storm_minutes,
    'campaignStage',v_run.campaign_stage,
    'experience',v_run.experience
  );

  v_world_delta := jsonb_build_object(
    'operation','place_structure',
    'structureType','habitat',
    'position',jsonb_build_object('x',p_position_x,'y',p_position_y,'z',p_position_z),
    'rotationY',v_rotation
  );

  insert into public.frontier_events (
    tenant_id,org_id,run_id,actor_user_id,action,idempotency_key,
    previous_revision,resulting_revision,before_state,resulting_state,world_delta
  ) values (
    p_org_id,p_org_id,v_run.id,v_user_id,'build_habitat',btrim(p_idempotency_key),
    v_run.revision-1,v_run.revision,v_before,v_after,v_world_delta
  )
  returning id into v_event_id;

  insert into public.frontier_structures (
    tenant_id,org_id,run_id,actor_user_id,source_event_id,structure_type,
    position_x,position_y,position_z,rotation_y,run_revision,placement_origin,idempotency_key
  ) values (
    p_org_id,p_org_id,v_run.id,v_user_id,v_event_id,'habitat',
    p_position_x,p_position_y,p_position_z,v_rotation,v_run.revision,'governed',btrim(p_idempotency_key)
  )
  returning * into v_structure;

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'revision',v_run.revision,
    'state',v_after,
    'event_id',v_event_id,
    'structure',jsonb_build_object(
      'id',v_structure.id,
      'structureType',v_structure.structure_type,
      'position',jsonb_build_object('x',v_structure.position_x,'y',v_structure.position_y,'z',v_structure.position_z),
      'rotationY',v_structure.rotation_y,
      'runRevision',v_structure.run_revision,
      'placementOrigin',v_structure.placement_origin
    )
  );
end;
$$;

revoke all on function public.frontier_build_structure(uuid,text,text,double precision,double precision,double precision,double precision)
  from public,anon;
grant execute on function public.frontier_build_structure(uuid,text,text,double precision,double precision,double precision,double precision)
  to authenticated;
