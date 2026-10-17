create table if not exists public.execution_connection_refs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  provider text not null check (length(trim(provider)) > 0),
  mechanism text not null check (mechanism in ('oauth','session','vault')),
  external_ref text not null check (length(trim(external_ref)) > 0),
  status text not null default 'active' check (status in ('active','revoked','expired','error')),
  capabilities jsonb not null default '[]'::jsonb,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, mechanism, external_ref)
);

create table if not exists public.execution_runtime_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  kind text not null check (kind in ('local','self_hosted','cloud_ephemeral')),
  label text not null check (length(trim(label)) > 0),
  status text not null default 'offline' check (status in ('online','offline','degraded','revoked')),
  capabilities jsonb not null default '[]'::jsonb,
  auth_token_hash text not null check (auth_token_hash ~ '^[a-f0-9]{64}$'),
  last_seen_at timestamptz,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.execution_runtime_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_id uuid not null references public.execution_workflows(id) on delete cascade,
  task_id uuid not null references public.execution_tasks(id) on delete cascade,
  step_id uuid not null references public.execution_steps(id) on delete cascade,
  runtime_id uuid references public.execution_runtime_registrations(id) on delete set null,
  runtime_kind text not null check (runtime_kind in ('local','self_hosted','cloud_ephemeral')),
  state text not null default 'queued' check (state in ('queued','claimed','running','waiting_human','completed','failed','cancelled')),
  execution_envelope jsonb not null,
  action jsonb not null,
  sanitized_result jsonb,
  lease_id uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'queued' and lease_id is null and lease_expires_at is null) or state <> 'queued')
);

create index if not exists execution_connection_refs_org_status_idx
  on public.execution_connection_refs(org_id,status,updated_at desc);
create index if not exists execution_runtimes_org_seen_idx
  on public.execution_runtime_registrations(org_id,status,last_seen_at desc);
create index if not exists execution_runtime_jobs_org_state_idx
  on public.execution_runtime_jobs(org_id,state,created_at);
create index if not exists execution_runtime_jobs_runtime_lease_idx
  on public.execution_runtime_jobs(runtime_id,state,lease_expires_at);

alter table public.execution_connection_refs enable row level security;
alter table public.execution_runtime_registrations enable row level security;
alter table public.execution_runtime_jobs enable row level security;

drop policy if exists execution_connection_refs_member_read on public.execution_connection_refs;
create policy execution_connection_refs_member_read on public.execution_connection_refs
for select to authenticated using (
  exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.org_id = execution_connection_refs.org_id
      and m.status = 'active'
  )
);

drop policy if exists execution_runtime_registrations_member_read on public.execution_runtime_registrations;
create policy execution_runtime_registrations_member_read on public.execution_runtime_registrations
for select to authenticated using (
  exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.org_id = execution_runtime_registrations.org_id
      and m.status = 'active'
  )
);

drop policy if exists execution_runtime_jobs_member_read on public.execution_runtime_jobs;
create policy execution_runtime_jobs_member_read on public.execution_runtime_jobs
for select to authenticated using (
  exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.org_id = execution_runtime_jobs.org_id
      and m.status = 'active'
  )
);

-- Raw support tables remain Edge/service-role only. RLS is still enabled as defense in depth,
-- but authenticated browser clients receive no table grants because these rows contain
-- opaque substrate references, runtime token hashes, or transient job payloads.
revoke all on public.execution_connection_refs from authenticated;
revoke all on public.execution_runtime_registrations from authenticated;
revoke all on public.execution_runtime_jobs from authenticated;

comment on table public.execution_connection_refs is 'Opaque authorized connection references. Provider credential material lives outside execution support tables; ordinary clients read normalized metadata through atlas-execution.';
comment on table public.execution_runtime_registrations is 'ATLAS Work runtime registrations. Authentication material is represented only by a SHA-256 hash and is never exposed by ordinary reads.';
comment on table public.execution_runtime_jobs is 'Leased, resumable runtime work constrained by a persisted execution envelope. Raw job rows are service-role/runtime only because an action may transiently contain a server-observed verification value.';
