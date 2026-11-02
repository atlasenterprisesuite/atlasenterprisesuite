-- ATLAS 777: isolated, deny-by-default schema for owned links. Not deployed.
create table if not exists public.atlas_owned_links (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id),
 tenant_id text not null,
 slug text not null check (slug ~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' and length(slug) <= 64),
 destination text not null check (length(destination) between 9 and 2048),
 created_by uuid not null,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique (org_id, tenant_id, slug)
);
alter table public.atlas_owned_links enable row level security;
alter table public.atlas_owned_links force row level security;
revoke all on public.atlas_owned_links from public, anon, authenticated;
-- No policies and no client grants until actual membership, tenant and revocation contracts are certified.
comment on table public.atlas_owned_links is 'ATLAS 777: server-only pending authenticated RLS policy and concurrent revocation certification';
