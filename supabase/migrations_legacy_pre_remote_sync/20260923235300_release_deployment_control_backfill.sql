-- ATLAS Release & Deployment Control
-- Source-control backfill reconstructed from the live Supabase control plane.
-- Idempotent by design; this file is NOT applied by this backfill PR.

create table if not exists public.atlas_releases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  release_key text not null unique,
  version text not null,
  channel text not null check (channel in ('development','staging','production')),
  status text not null default 'draft' check (status in ('draft','candidate','validating','ready','deploying','verifying','promoted','awaiting_approval','blocked','failed','rolling_back','rolled_back','superseded','cancelled')),
  manifest_hash text not null default repeat('0',64) check (manifest_hash ~ '^[0-9a-f]{64}$'),
  source_ref text,
  requested_by uuid,
  approval_id uuid references public.atlas_approvals(id),
  rollback_of_release_id uuid references public.atlas_releases(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  frozen_at timestamptz,
  promoted_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.atlas_release_components (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.atlas_releases(id) on delete cascade,
  component_type text not null check (component_type in ('edge_function','database_migration','web_bundle','worker','runtime','configuration','integration')),
  component_key text not null,
  artifact_ref text,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  target_version text not null,
  provider text not null check (provider in ('supabase','github','cloudflare','vercel','atlas-native')),
  deployment_order integer not null default 100 check (deployment_order>=0),
  rollback_strategy text not null check (rollback_strategy in ('redeploy_previous','restore_snapshot','forward_fix','manual_only','not_reversible')),
  rollback_ref text,
  requires_migration boolean not null default false,
  migration_ref text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=8000),
  created_at timestamptz not null default now(),
  unique(release_id, component_key)
);

create table if not exists public.atlas_deployments (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.atlas_releases(id),
  org_id uuid references public.organizations(id),
  environment text not null check (environment in ('development','staging','production')),
  deployment_kind text not null check (deployment_kind in ('promote','rollback','reverify')),
  status text not null default 'queued' check (status in ('queued','awaiting_approval','executing','provider_complete','verifying','promoted','blocked','failed','rolling_back','rolled_back','cancelled')),
  provider_execution_state text not null default 'not_started' check (provider_execution_state in ('not_started','running','succeeded','failed','blocked','unknown')),
  health_state text not null default 'not_checked' check (health_state in ('not_checked','checking','healthy','degraded','unhealthy','blocked')),
  attempt integer not null default 1 check (attempt>=1),
  requested_by uuid,
  approval_id uuid references public.atlas_approvals(id),
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  trace_id text,
  error_code text,
  error_detail text check (error_detail is null or length(error_detail)<=1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(release_id, environment, deployment_kind, attempt)
);

create table if not exists public.atlas_deployment_gates (
  id uuid primary key default gen_random_uuid(),
  deployment_id uuid not null references public.atlas_deployments(id) on delete cascade,
  gate_key text not null,
  gate_type text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','running','passed','failed','blocked','waived','expired')),
  verification_run_id uuid references public.atlas_runtime_verification_runs(id),
  approval_id uuid references public.atlas_approvals(id),
  evidence_ref text,
  evaluated_at timestamptz,
  expires_at timestamptz,
  error_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deployment_id, gate_key)
);

alter table public.atlas_releases enable row level security;
alter table public.atlas_release_components enable row level security;
alter table public.atlas_deployments enable row level security;
alter table public.atlas_deployment_gates enable row level security;

create index if not exists idx_atlas_releases_org_status on public.atlas_releases(org_id,status,created_at desc);
create index if not exists idx_atlas_release_components_release on public.atlas_release_components(release_id,deployment_order);
create index if not exists idx_atlas_deployments_release on public.atlas_deployments(release_id,environment,status);
create index if not exists idx_atlas_deployment_gates_deployment on public.atlas_deployment_gates(deployment_id,required,status);

-- Canonical production baseline registration recovered from Supabase.
insert into public.atlas_releases(
  id,org_id,release_key,version,channel,status,manifest_hash,source_ref,metadata,
  created_at,updated_at,frozen_at,promoted_at
) values (
  'dc699ce0-8a5b-43c1-9c8f-9e92f738163a',null,'atlas-production-baseline-2026-09-08',
  '2026.09.08.baseline.1','production','promoted',
  '55b10d5a208094b9532c9ef7f61d6d17b8c854a833fc13dc5b447655498251c8',
  'supabase-native:current-production',
  '{"baseline":true,"normalization_only":true,"historical_registry_rewritten":false}'::jsonb,
  '2026-09-09T03:01:39.240246Z','2026-09-09T03:04:25.193581Z',
  '2026-09-09T03:01:39.240246Z','2026-09-09T03:04:25.193581Z'
) on conflict (release_key) do nothing;

insert into public.atlas_release_components
(release_id,component_type,component_key,artifact_ref,artifact_sha256,target_version,provider,deployment_order,rollback_strategy,rollback_ref,requires_migration,metadata)
values
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-enterprise-web','edge:atlas-enterprise-web','52abf998fd4d5cb50e7e1f5fdc1f7afac61e852e15cde5d1dd44928485b3b629','5','supabase',100,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-public-health','edge:atlas-public-health','8d624632ea36fcfa5612b63feeaaa1b19e772dc8a00f5dbcf8ee7665439c6ba7','5','supabase',110,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-observability','edge:atlas-observability','7d8ed3d6ca0b6b67f931263ef1c47d5af4edee1b60d524e9c1543c812e9dadec','1','supabase',120,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-governance','edge:atlas-governance','66ce9e9d8941a1d718dbe005cd3fe101a4e6c7510b80bae31871994a46243e1b','1','supabase',130,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-infra-status','edge:atlas-infra-status','3ae19114bd99ad2da4f52e1cfd98e5c02cabae068ae5366b158be30b698fbec7','9','supabase',140,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-auth','edge:atlas-auth','637119a51b26e7630ed214374ad81251bb95d8283637de44d5bf3d6c2cf8fa5d','6','supabase',150,'manual_only',null,false,'{"sensitive_class":"auth"}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-copilot','edge:atlas-copilot','e37ff85e782c34e7c9cbea78915134cc232b59ca12609da2e7bdaa3b6c190252','7','supabase',160,'redeploy_previous','previous-known-version',false,'{}'),
('dc699ce0-8a5b-43c1-9c8f-9e92f738163a','edge_function','atlas-release-control','edge:atlas-release-control','8899f6231a5b159a7770946fa533008f0e74b8e60e7a16f9d1628516f54ed5f9','2','supabase',170,'redeploy_previous','previous-known-version',false,'{}')
on conflict (release_id,component_key) do nothing;

comment on table public.atlas_releases is 'ATLAS Release & Deployment Control release registry; backfilled from Supabase 2026-09-23.';
