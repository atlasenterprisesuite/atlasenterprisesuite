-- ATLAS FRONTIER physical biome traversal.
-- Biome transitions are server-authoritative, organization scoped and append-only audited.

create table if not exists public.frontier_world_presence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  position_x double precision not null default 0 check (position_x between -8 and 8),
  position_z double precision not null default 2.8 check (position_z between -8 and 8),
  biome_entry_id text not null default 'biome-luminous-grove'
    references public.frontier_codex_entries(id) on delete restrict,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint frontier_world_presence_scope_check check (tenant_id = org_id),
  constraint frontier_world_presence_actor_unique unique (org_id, actor_user_id)
);

create table if not exists public.frontier_world_presence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.frontier_runs(id) on delete cascade,
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_biome_entry_id text references public.frontier_codex_entries(id) on delete restrict,
  to_biome_entry_id text not null references public.frontier_codex_entries(id) on delete restrict,
  position_x double precision not null check (position_x between -8 and 8),
  position_z double precision not null check (position_z between -8 and 8),
  idempotency_key text not null check (char_length(btrim(idempotency_key)) between 8 and 160),
  resulting_revision integer not null check (resulting_revision >= 1),
  created_at timestamptz not null default now(),
  constraint frontier_world_presence_events_scope_check check (tenant_id = org_id),
  constraint frontier_world_presence_events_idempotency_unique unique (org_id, actor_user_id, idempotency_key)
);

create index if not exists frontier_world_presence_run_idx
  on public.frontier_world_presence(run_id);
create index if not exists frontier_world_presence_events_run_created_idx
  on public.frontier_world_presence_events(run_id, created_at desc);
create index if not exists frontier_world_presence_events_actor_idx
  on public.frontier_world_presence_events(actor_user_id);

insert into public.frontier_world_presence(
  tenant_id, org_id, run_id, actor_user_id,
  position_x, position_z, biome_entry_id, revision
)
select
  r.tenant_id, r.org_id, r.id, r.actor_user_id,
  0::double precision, 2.8::double precision, 'biome-luminous-grove', 0
from public.frontier_runs r
on conflict (org_id, actor_user_id) do nothing;

alter table public.frontier_world_presence enable row level security;
alter table public.frontier_world_presence_events enable row level security;

revoke all on public.frontier_world_presence from anon, authenticated;
revoke all on public.frontier_world_presence_events from anon, authenticated;
grant select on public.frontier_world_presence to authenticated;
grant select on public.frontier_world_presence_events to authenticated;
grant all on public.frontier_world_presence to service_role;
grant all on public.frontier_world_presence_events to service_role;

drop policy if exists frontier_world_presence_read_own on public.frontier_world_presence;
create policy frontier_world_presence_read_own
  on public.frontier_world_presence for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.has_identity_permission(org_id, 'frontier.read')
      or public.has_identity_permission(org_id, 'frontier.play')
      or public.has_identity_permission(org_id, 'frontier.manage')
    )
  );

drop policy if exists frontier_world_presence_events_read on public.frontier_world_presence_events;
create policy frontier_world_presence_events_read
  on public.frontier_world_presence_events for select to authenticated
  using (
    (actor_user_id = (select auth.uid()) and public.has_identity_permission(org_id, 'frontier.read'))
    or public.has_identity_permission(org_id, 'frontier.manage')
  );

create or replace function public.frontier_transition_biome(
  p_org_id uuid,
  p_entry_id text,
  p_position_x double precision,
  p_position_z double precision,
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
  v_entry public.frontier_codex_entries%rowtype;
  v_presence public.frontier_world_presence%rowtype;
  v_existing public.frontier_world_presence_events%rowtype;
  v_expected_entry_id text;
  v_from_entry_id text;
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

  if p_position_x is null or p_position_z is null
     or p_position_x < -8 or p_position_x > 8
     or p_position_z < -8 or p_position_z > 8 then
    raise exception 'frontier_presence_out_of_bounds' using errcode = '22023';
  end if;

  v_expected_entry_id := case
    when p_position_x < -4 then 'biome-aether-fields'
    when p_position_x > 4 and p_position_z < 0 then 'biome-cloud-steppe'
    when p_position_x > 4 then 'biome-abandoned-city'
    when p_position_z < -5 then 'biome-thermal-rifts'
    when p_position_z > 5 then 'biome-tidal-reefs'
    else 'biome-luminous-grove'
  end;

  if btrim(coalesce(p_entry_id, '')) <> v_expected_entry_id then
    raise exception 'frontier_biome_position_mismatch' using errcode = '22023';
  end if;

  select * into v_existing
  from public.frontier_world_presence_events
  where org_id = p_org_id
    and actor_user_id = v_user_id
    and idempotency_key = btrim(p_idempotency_key);

  if found then
    select * into v_presence
    from public.frontier_world_presence
    where org_id = p_org_id and actor_user_id = v_user_id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'entry_id', v_existing.to_biome_entry_id,
      'position_x', v_presence.position_x,
      'position_z', v_presence.position_z,
      'revision', v_existing.resulting_revision
    );
  end if;

  select * into v_run
  from public.frontier_runs
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if not found then
    raise exception 'frontier_run_unavailable';
  end if;

  select * into v_entry
  from public.frontier_codex_entries
  where id = v_expected_entry_id and category = 'biome';

  if not found then
    raise exception 'frontier_biome_unknown' using errcode = '22023';
  end if;

  if v_entry.required_stage > v_run.campaign_stage then
    raise exception 'frontier_biome_locked' using errcode = 'P0001';
  end if;

  select * into v_presence
  from public.frontier_world_presence
  where org_id = p_org_id and actor_user_id = v_user_id
  for update;

  if found then
    v_from_entry_id := v_presence.biome_entry_id;

    update public.frontier_world_presence
    set position_x = p_position_x,
        position_z = p_position_z,
        biome_entry_id = v_expected_entry_id,
        revision = revision + 1,
        updated_at = now()
    where id = v_presence.id
    returning * into v_presence;
  else
    v_from_entry_id := null;

    insert into public.frontier_world_presence(
      tenant_id, org_id, run_id, actor_user_id,
      position_x, position_z, biome_entry_id, revision
    )
    values (
      p_org_id, p_org_id, v_run.id, v_user_id,
      p_position_x, p_position_z, v_expected_entry_id, 1
    )
    returning * into v_presence;
  end if;

  insert into public.frontier_codex_discoveries(
    tenant_id, org_id, run_id, actor_user_id, entry_id, run_revision
  )
  values (
    p_org_id, p_org_id, v_run.id, v_user_id, v_expected_entry_id, v_run.revision
  )
  on conflict (org_id, actor_user_id, entry_id) do nothing;

  insert into public.frontier_world_presence_events(
    tenant_id, org_id, run_id, actor_user_id,
    from_biome_entry_id, to_biome_entry_id,
    position_x, position_z, idempotency_key, resulting_revision
  )
  values (
    p_org_id, p_org_id, v_run.id, v_user_id,
    v_from_entry_id, v_expected_entry_id,
    p_position_x, p_position_z, btrim(p_idempotency_key), v_presence.revision
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'entry_id', v_presence.biome_entry_id,
    'position_x', v_presence.position_x,
    'position_z', v_presence.position_z,
    'revision', v_presence.revision
  );
end;
$$;

revoke all on function public.frontier_transition_biome(uuid, text, double precision, double precision, text)
  from public, anon;
grant execute on function public.frontier_transition_biome(uuid, text, double precision, double precision, text)
  to authenticated;

comment on function public.frontier_transition_biome(uuid, text, double precision, double precision, text) is
  'Server-authoritative FRONTIER biome transition. Validates world coordinates, canonical biome mapping, campaign stage, RBAC and idempotency, then persists presence, discovery and audit atomically.';

create or replace function public.frontier_validate_structure_biome_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign_stage integer;
  v_biome_entry_id text;
  v_required_stage integer;
begin
  if new.placement_origin <> 'governed' then
    return new;
  end if;

  select campaign_stage into v_campaign_stage
  from public.frontier_runs
  where id = new.run_id
    and org_id = new.org_id
    and actor_user_id = new.actor_user_id;

  if not found then
    raise exception 'frontier_run_unavailable';
  end if;

  v_biome_entry_id := case
    when new.position_x < -4 then 'biome-aether-fields'
    when new.position_x > 4 and new.position_z < 0 then 'biome-cloud-steppe'
    when new.position_x > 4 then 'biome-abandoned-city'
    when new.position_z < -5 then 'biome-thermal-rifts'
    when new.position_z > 5 then 'biome-tidal-reefs'
    else 'biome-luminous-grove'
  end;

  select required_stage into v_required_stage
  from public.frontier_codex_entries
  where id = v_biome_entry_id and category = 'biome';

  if v_required_stage is null then
    raise exception 'frontier_biome_unknown';
  end if;

  if v_required_stage > v_campaign_stage then
    raise exception 'frontier_structure_biome_locked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.frontier_validate_structure_biome_gate() from public, anon, authenticated;

drop trigger if exists frontier_structures_biome_gate on public.frontier_structures;
create trigger frontier_structures_biome_gate
before insert or update of position_x, position_z, run_id, org_id, actor_user_id
on public.frontier_structures
for each row execute function public.frontier_validate_structure_biome_gate();

comment on table public.frontier_world_presence is
  'Durable organization/player-scoped FRONTIER world position captured at governed biome transitions.';
comment on table public.frontier_world_presence_events is
  'Append-only audit of governed FRONTIER biome transitions and persistent presence revisions.';
