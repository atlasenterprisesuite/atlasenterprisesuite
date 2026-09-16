-- ATLAS Health — Jaque Mate + Sentinel v2 persistence and RBAC foundation.
-- Canonical module: atlas.health.jaque-mate-sentinel.v1
-- Research/simulation only. This migration does not authorize automated clinical action.

insert into public.identity_permissions (code, description)
values
  ('atlas.jm.sentinel.read', 'Read tenant-scoped ATLAS Health Jaque Mate + Sentinel research evidence, simulation records, and configuration.'),
  ('atlas.jm.sentinel.write', 'Create or update permitted ATLAS Health Jaque Mate + Sentinel hypotheses, simulations, and configuration.'),
  ('atlas.jm.sentinel.audit', 'Audit tenant-scoped ATLAS Health Jaque Mate + Sentinel evidence provenance and research activity.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'atlas.jm.sentinel.read'),
  ('owner', 'atlas.jm.sentinel.write'),
  ('owner', 'atlas.jm.sentinel.audit'),
  ('admin', 'atlas.jm.sentinel.read'),
  ('admin', 'atlas.jm.sentinel.write'),
  ('admin', 'atlas.jm.sentinel.audit')
on conflict do nothing;

create table if not exists public.health_evidence_validated (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  evidence_type text not null default 'VALIDATED' check (evidence_type = 'VALIDATED'),
  source_identifier text not null check (length(trim(source_identifier)) > 0),
  confirmed_at timestamptz not null,
  provenance_kind text not null check (provenance_kind in ('LAB', 'HARDWARE', 'REGISTRY')),
  payload jsonb not null default '{}'::jsonb,
  ingested_by_service text not null check (length(trim(ingested_by_service)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.health_evidence_hypotheses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  evidence_type text not null default 'HYPOTHESIS' check (evidence_type = 'HYPOTHESIS'),
  hypothesis_key text not null check (length(trim(hypothesis_key)) > 0),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, hypothesis_key)
);

create table if not exists public.health_evidence_simulation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  evidence_type text not null default 'SIMULATION' check (evidence_type = 'SIMULATION'),
  simulation_key text not null check (length(trim(simulation_key)) > 0),
  watermark text not null default 'SIMULATION — NOT CLINICAL EVIDENCE'
    check (watermark = 'SIMULATION — NOT CLINICAL EVIDENCE'),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, simulation_key)
);

create table if not exists public.health_sentinel_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  config_key text not null check (config_key in (
    'sentinel.fitness.threshold',
    'sentinel.memory.pathological_depth',
    'sentinel.cost.surveillance_rate'
  )),
  numeric_value numeric,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, config_key)
);

create index if not exists health_evidence_validated_org_created_idx
  on public.health_evidence_validated (org_id, created_at desc);
create index if not exists health_evidence_hypotheses_org_created_idx
  on public.health_evidence_hypotheses (org_id, created_at desc);
create index if not exists health_evidence_simulation_org_created_idx
  on public.health_evidence_simulation (org_id, created_at desc);
create index if not exists health_sentinel_config_org_key_idx
  on public.health_sentinel_config (org_id, config_key);

alter table public.health_evidence_validated enable row level security;
alter table public.health_evidence_hypotheses enable row level security;
alter table public.health_evidence_simulation enable row level security;
alter table public.health_sentinel_config enable row level security;

-- Policies intentionally combine active organization membership with canonical ATLAS Identity permissions.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_evidence_validated'
      and policyname = 'health_evidence_validated_authorized_read'
  ) then
    create policy health_evidence_validated_authorized_read
      on public.health_evidence_validated
      for select
      to authenticated
      using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = health_evidence_validated.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and (
          public.has_identity_permission(health_evidence_validated.org_id, 'atlas.jm.sentinel.read')
          or public.has_identity_permission(health_evidence_validated.org_id, 'atlas.jm.sentinel.audit')
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_evidence_hypotheses'
      and policyname = 'health_evidence_hypotheses_authorized_read'
  ) then
    create policy health_evidence_hypotheses_authorized_read
      on public.health_evidence_hypotheses
      for select
      to authenticated
      using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = health_evidence_hypotheses.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and (
          public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.read')
          or public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.audit')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_evidence_hypotheses'
      and policyname = 'health_evidence_hypotheses_authorized_insert'
  ) then
    create policy health_evidence_hypotheses_authorized_insert
      on public.health_evidence_hypotheses
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and exists (
          select 1 from public.organization_members om
          where om.org_id = health_evidence_hypotheses.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and public.has_identity_permission(health_evidence_hypotheses.org_id, 'atlas.jm.sentinel.write')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_evidence_simulation'
      and policyname = 'health_evidence_simulation_authorized_read'
  ) then
    create policy health_evidence_simulation_authorized_read
      on public.health_evidence_simulation
      for select
      to authenticated
      using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = health_evidence_simulation.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and (
          public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.read')
          or public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.audit')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_evidence_simulation'
      and policyname = 'health_evidence_simulation_authorized_insert'
  ) then
    create policy health_evidence_simulation_authorized_insert
      on public.health_evidence_simulation
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and watermark = 'SIMULATION — NOT CLINICAL EVIDENCE'
        and exists (
          select 1 from public.organization_members om
          where om.org_id = health_evidence_simulation.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and public.has_identity_permission(health_evidence_simulation.org_id, 'atlas.jm.sentinel.write')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_sentinel_config'
      and policyname = 'health_sentinel_config_authorized_read'
  ) then
    create policy health_sentinel_config_authorized_read
      on public.health_sentinel_config
      for select
      to authenticated
      using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = health_sentinel_config.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and (
          public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.read')
          or public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.audit')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_sentinel_config'
      and policyname = 'health_sentinel_config_authorized_insert'
  ) then
    create policy health_sentinel_config_authorized_insert
      on public.health_sentinel_config
      for insert
      to authenticated
      with check (
        updated_by = auth.uid()
        and exists (
          select 1 from public.organization_members om
          where om.org_id = health_sentinel_config.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'health_sentinel_config'
      and policyname = 'health_sentinel_config_authorized_update'
  ) then
    create policy health_sentinel_config_authorized_update
      on public.health_sentinel_config
      for update
      to authenticated
      using (
        exists (
          select 1 from public.organization_members om
          where om.org_id = health_sentinel_config.org_id
            and om.user_id = auth.uid()
            and om.status = 'active'
        )
        and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
      )
      with check (
        updated_by = auth.uid()
        and public.has_identity_permission(health_sentinel_config.org_id, 'atlas.jm.sentinel.write')
      );
  end if;
end
$$;

revoke all on public.health_evidence_validated from anon, authenticated;
revoke all on public.health_evidence_hypotheses from anon, authenticated;
revoke all on public.health_evidence_simulation from anon, authenticated;
revoke all on public.health_sentinel_config from anon, authenticated;

grant select on public.health_evidence_validated to authenticated;
grant all on public.health_evidence_validated to service_role;

grant select on public.health_evidence_hypotheses to authenticated;
grant insert on public.health_evidence_hypotheses to authenticated;
grant all on public.health_evidence_hypotheses to service_role;

grant select on public.health_evidence_simulation to authenticated;
grant insert on public.health_evidence_simulation to authenticated;
grant all on public.health_evidence_simulation to service_role;

grant select on public.health_sentinel_config to authenticated;
grant insert on public.health_sentinel_config to authenticated;
grant update on public.health_sentinel_config to authenticated;
grant all on public.health_sentinel_config to service_role;

comment on table public.health_evidence_validated is
  'Validated ATLAS Health evidence with explicit source provenance. Browser roles are read-only; approved service pipelines control ingestion.';
comment on table public.health_evidence_hypotheses is
  'Research hypotheses isolated from validated clinical evidence. Contents must never be presented as confirmed clinical facts.';
comment on table public.health_evidence_simulation is
  'Educational/research simulation records carrying the immutable SIMULATION — NOT CLINICAL EVIDENCE boundary.';
comment on table public.health_sentinel_config is
  'Tenant-scoped Sentinel tuning configuration. NULL numeric_value means not configured; no placeholder research values are promoted to production defaults.';
