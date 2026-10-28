insert into public.identity_permissions(code,description) values
  ('releases.read','Read ATLAS release and deployment state'),
  ('releases.create','Create ATLAS release drafts and components'),
  ('releases.manage','Manage non-terminal ATLAS release state'),
  ('releases.deploy','Create and execute ATLAS deployments'),
  ('releases.promote','Promote verified ATLAS production deployments'),
  ('releases.rollback','Request or execute policy-authorized rollback'),
  ('releases.waive_gate','Waive policy-waivable deployment gates with approval')
on conflict (code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code) values
  ('owner','releases.read'),('owner','releases.create'),('owner','releases.manage'),('owner','releases.deploy'),('owner','releases.promote'),('owner','releases.rollback'),('owner','releases.waive_gate'),
  ('admin','releases.read'),('admin','releases.create'),('admin','releases.manage'),('admin','releases.deploy'),('admin','releases.promote'),('admin','releases.rollback'),('admin','releases.waive_gate'),
  ('manager','releases.read'),('manager','releases.create'),('manager','releases.manage')
on conflict do nothing;

create table public.atlas_releases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete set null,
  release_key text not null unique,
  version text not null,
  channel text not null check (channel in ('development','staging','production')),
  status text not null default 'draft' check (status in (
    'draft','candidate','validating','ready','deploying','verifying','promoted',
    'awaiting_approval','blocked','failed','rolling_back','rolled_back','superseded','cancelled'
  )),
  manifest_hash text not null default repeat('0',64),
  source_ref text null,
  requested_by uuid null,
  approval_id uuid null references public.atlas_approvals(id) on delete set null,
  rollback_of_release_id uuid null references public.atlas_releases(id) on delete set null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  frozen_at timestamptz null,
  promoted_at timestamptz null,
  cancelled_at timestamptz null,
  constraint atlas_releases_manifest_hash_shape check (manifest_hash ~ '^[0-9a-f]{64}$'),
  constraint atlas_releases_terminal_time_check check (
    ((status='promoted' and promoted_at is not null) or status<>'promoted')
    and ((status='cancelled' and cancelled_at is not null) or status<>'cancelled')
  )
);

create table public.atlas_release_components (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.atlas_releases(id) on delete cascade,
  component_type text not null check (component_type in ('edge_function','database_migration','web_bundle','worker','runtime','configuration','integration')),
  component_key text not null,
  artifact_ref text null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  target_version text not null,
  provider text not null check (provider in ('supabase','github','cloudflare','vercel','atlas-native')),
  deployment_order integer not null default 100 check (deployment_order >= 0),
  rollback_strategy text not null check (rollback_strategy in ('redeploy_previous','restore_snapshot','forward_fix','manual_only','not_reversible')),
  rollback_ref text null,
  requires_migration boolean not null default false,
  migration_ref text null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 8000),
  created_at timestamptz not null default now(),
  unique(release_id,component_type,component_key)
);

create table public.atlas_deployments (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.atlas_releases(id) on delete restrict,
  org_id uuid null references public.organizations(id) on delete set null,
  environment text not null check (environment in ('development','staging','production')),
  deployment_kind text not null check (deployment_kind in ('promote','rollback','reverify')),
  status text not null default 'queued' check (status in ('queued','awaiting_approval','executing','provider_complete','verifying','promoted','blocked','failed','rolling_back','rolled_back','cancelled')),
  provider_execution_state text not null default 'not_started' check (provider_execution_state in ('not_started','running','succeeded','failed','blocked','unknown')),
  health_state text not null default 'not_checked' check (health_state in ('not_checked','checking','healthy','degraded','unhealthy','blocked')),
  attempt integer not null default 1 check (attempt >= 1),
  requested_by uuid null,
  approval_id uuid null references public.atlas_approvals(id) on delete set null,
  started_at timestamptz null,
  completed_at timestamptz null,
  verified_at timestamptz null,
  trace_id text null,
  error_code text null,
  error_detail text null check (error_detail is null or length(error_detail) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id,environment,deployment_kind,attempt)
);

create table public.atlas_deployment_gates (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.atlas_deployments(id) on delete cascade,
  gate_key text not null,
  gate_type text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','running','passed','failed','blocked','waived','expired')),
  verification_run_id uuid null references public.atlas_runtime_verification_runs(id) on delete set null,
  approval_id uuid null references public.atlas_approvals(id) on delete set null,
  evidence_ref text null,
  evaluated_at timestamptz null,
  expires_at timestamptz null,
  error_code text null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deployment_id,gate_key)
);

create index atlas_release_components_release_idx on public.atlas_release_components(release_id,deployment_order,component_key);
create index atlas_releases_org_channel_status_idx on public.atlas_releases(org_id,channel,status,updated_at desc);
create index atlas_releases_approval_idx on public.atlas_releases(approval_id);
create index atlas_releases_rollback_of_idx on public.atlas_releases(rollback_of_release_id);
create index atlas_deployments_release_idx on public.atlas_deployments(release_id,environment,created_at desc);
create index atlas_deployments_org_status_idx on public.atlas_deployments(org_id,environment,status,updated_at desc);
create index atlas_deployments_approval_idx on public.atlas_deployments(approval_id);
create index atlas_deployment_gates_deployment_status_idx on public.atlas_deployment_gates(deployment_id,status,required);
create index atlas_deployment_gates_verification_idx on public.atlas_deployment_gates(verification_run_id);
create index atlas_deployment_gates_approval_idx on public.atlas_deployment_gates(approval_id);
create unique index atlas_releases_one_platform_promoted_per_channel_idx on public.atlas_releases(channel) where org_id is null and status='promoted';
create unique index atlas_releases_one_tenant_promoted_per_channel_idx on public.atlas_releases(org_id,channel) where org_id is not null and status='promoted';

create or replace function atlas_private.is_release_platform_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(
    select 1 from public.atlas_platform_admins a
    where a.user_id=p_user_id and a.enabled=true
  );
$$;
revoke all on function atlas_private.is_release_platform_admin(uuid) from public,anon;
grant execute on function atlas_private.is_release_platform_admin(uuid) to authenticated,service_role;

alter table public.atlas_releases enable row level security;
alter table public.atlas_release_components enable row level security;
alter table public.atlas_deployments enable row level security;
alter table public.atlas_deployment_gates enable row level security;

revoke all on public.atlas_releases,public.atlas_release_components,public.atlas_deployments,public.atlas_deployment_gates from public,anon,authenticated;
grant select,insert,update on public.atlas_releases,public.atlas_release_components,public.atlas_deployments,public.atlas_deployment_gates to authenticated;
grant delete on public.atlas_release_components to authenticated;
grant all on public.atlas_releases,public.atlas_release_components,public.atlas_deployments,public.atlas_deployment_gates to service_role;

create policy atlas_releases_read on public.atlas_releases for select to authenticated using (
  (org_id is not null and public.has_identity_permission(org_id,'releases.read'))
  or (org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
);
create policy atlas_releases_create on public.atlas_releases for insert to authenticated with check (
  status='draft' and requested_by=(select auth.uid()) and (
    (org_id is not null and public.has_identity_permission(org_id,'releases.create'))
    or (org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  )
);
create policy atlas_releases_update_draft on public.atlas_releases for update to authenticated using (
  status='draft' and (
    (org_id is not null and public.has_identity_permission(org_id,'releases.manage'))
    or (org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  )
) with check (status='draft');

create policy atlas_release_components_read on public.atlas_release_components for select to authenticated using (
  exists(select 1 from public.atlas_releases r where r.id=release_id and (
    (r.org_id is not null and public.has_identity_permission(r.org_id,'releases.read'))
    or (r.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
);
create policy atlas_release_components_insert on public.atlas_release_components for insert to authenticated with check (
  exists(select 1 from public.atlas_releases r where r.id=release_id and r.status='draft' and (
    (r.org_id is not null and public.has_identity_permission(r.org_id,'releases.create'))
    or (r.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
);
create policy atlas_release_components_update on public.atlas_release_components for update to authenticated using (
  exists(select 1 from public.atlas_releases r where r.id=release_id and r.status='draft' and (
    (r.org_id is not null and public.has_identity_permission(r.org_id,'releases.manage'))
    or (r.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
) with check (
  exists(select 1 from public.atlas_releases r where r.id=release_id and r.status='draft' and (
    (r.org_id is not null and public.has_identity_permission(r.org_id,'releases.manage'))
    or (r.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
);
create policy atlas_release_components_delete on public.atlas_release_components for delete to authenticated using (
  exists(select 1 from public.atlas_releases r where r.id=release_id and r.status='draft' and (
    (r.org_id is not null and public.has_identity_permission(r.org_id,'releases.manage'))
    or (r.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
);

create policy atlas_deployments_read on public.atlas_deployments for select to authenticated using (
  (org_id is not null and public.has_identity_permission(org_id,'releases.read'))
  or (org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
);
create policy atlas_deployment_gates_read on public.atlas_deployment_gates for select to authenticated using (
  exists(select 1 from public.atlas_deployments d where d.id=deployment_id and (
    (d.org_id is not null and public.has_identity_permission(d.org_id,'releases.read'))
    or (d.org_id is null and atlas_private.is_release_platform_admin((select auth.uid())))
  ))
);

revoke insert,update,delete,truncate,trigger,references on public.atlas_release_registry from anon,authenticated;
revoke all on public.atlas_release_registry from anon;
grant select on public.atlas_release_registry to authenticated;
grant all on public.atlas_release_registry to service_role;
