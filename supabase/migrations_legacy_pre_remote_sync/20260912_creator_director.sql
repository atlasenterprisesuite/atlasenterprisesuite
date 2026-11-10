create table if not exists public.creator_productions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  title text not null default '',
  brief text not null default '',
  status text not null default 'draft' check (status in ('draft','validating','blocked','ready','submitting','generating','completed','failed')),
  duration_seconds numeric not null default 0 check (duration_seconds >= 0),
  aspect_ratio text not null default 'adaptive',
  resolution_preference text not null default 'adaptive',
  audio_enabled boolean not null default true,
  production_spec_json jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_provider_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_id text not null check (provider_id in ('seedance','veo','kling','wan','minimax')),
  display_name text not null,
  state text not null default 'unconfigured' check (state in ('unconfigured','configured-unverified','ready','unavailable','insufficient-credit','error')),
  capability_json jsonb not null default '{}'::jsonb,
  cost_estimator_available boolean not null default false,
  last_verified_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_id)
);

create table if not exists public.creator_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid not null references public.creator_productions(id) on delete cascade,
  requested_by uuid not null,
  provider_id text not null,
  provider_job_id text,
  status text not null check (status in ('queued','submitted','generating','completed','failed','cancelled')),
  compiled_prompt text not null,
  normalized_params_json jsonb not null default '{}'::jsonb,
  estimated_cost_json jsonb,
  actual_cost_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid not null references public.creator_productions(id) on delete cascade,
  generation_job_id uuid references public.creator_generation_jobs(id) on delete set null,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video','audio')),
  provider_id text,
  provider_asset_id text,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric,
  provenance_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_productions_org_updated_idx
  on public.creator_productions (organization_id, updated_at desc);
create index if not exists creator_provider_instances_org_provider_state_idx
  on public.creator_provider_instances (organization_id, provider_id, state);
create index if not exists creator_generation_jobs_org_production_created_idx
  on public.creator_generation_jobs (organization_id, production_id, created_at desc);
create index if not exists creator_assets_org_production_created_idx
  on public.creator_assets (organization_id, production_id, created_at desc);

alter table public.creator_productions enable row level security;
alter table public.creator_provider_instances enable row level security;
alter table public.creator_generation_jobs enable row level security;
alter table public.creator_assets enable row level security;

create policy creator_productions_member_read
on public.creator_productions
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_productions.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy creator_provider_instances_member_read
on public.creator_provider_instances
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_provider_instances.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy creator_generation_jobs_member_read
on public.creator_generation_jobs
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_generation_jobs.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy creator_assets_member_read
on public.creator_assets
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = creator_assets.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke all on public.creator_productions from authenticated;
revoke all on public.creator_provider_instances from authenticated;
revoke all on public.creator_generation_jobs from authenticated;
revoke all on public.creator_assets from authenticated;

grant select on public.creator_productions to authenticated;
grant select on public.creator_provider_instances to authenticated;
grant select on public.creator_generation_jobs to authenticated;
grant select on public.creator_assets to authenticated;
