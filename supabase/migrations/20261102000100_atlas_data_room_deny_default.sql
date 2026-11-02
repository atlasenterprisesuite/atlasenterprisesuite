-- ATLAS Secure Data Room 777: isolated schema contract, NOT applied to production.
-- Private, deny-by-default tables. No Data API grants are introduced.
create table if not exists public.atlas_data_room_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  tenant_id uuid not null,
  storage_path text not null check (length(btrim(storage_path)) > 0),
  created_by uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, organization_id, tenant_id)
);
create table if not exists public.atlas_data_room_grants (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  organization_id uuid not null,
  tenant_id uuid not null,
  grantee_user_id uuid not null,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (document_id, organization_id, tenant_id)
    references public.atlas_data_room_documents(id, organization_id, tenant_id),
  unique (document_id, grantee_user_id)
);
create table if not exists public.atlas_data_room_access_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid,
  organization_id uuid not null,
  tenant_id uuid not null,
  actor_user_id uuid,
  outcome text not null check (outcome in ('allow','deny')),
  occurred_at timestamptz not null default now()
);
create index if not exists atlas_data_room_grants_actor_idx
  on public.atlas_data_room_grants(grantee_user_id, organization_id, tenant_id);
create index if not exists atlas_data_room_access_events_org_time_idx
  on public.atlas_data_room_access_events(organization_id, occurred_at desc);
alter table public.atlas_data_room_documents enable row level security;
alter table public.atlas_data_room_grants enable row level security;
alter table public.atlas_data_room_access_events enable row level security;
alter table public.atlas_data_room_documents force row level security;
alter table public.atlas_data_room_grants force row level security;
alter table public.atlas_data_room_access_events force row level security;
revoke all on public.atlas_data_room_documents from public, anon, authenticated;
revoke all on public.atlas_data_room_grants from public, anon, authenticated;
revoke all on public.atlas_data_room_access_events from public, anon, authenticated;
-- Intentionally no policies, RPCs, storage policies, or privileged grants.
-- Dedicated authorization and auditable access transactions require
-- isolated PostgreSQL tests before opening any read path.
