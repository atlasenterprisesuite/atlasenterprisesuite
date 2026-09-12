-- ATLAS Google Workspace integration foundation.
-- Adds RBAC permission and short-lived, one-time OAuth state persistence.

insert into public.identity_permissions (code, description)
values (
  'integrations.manage',
  'Connect, configure, and manage external integrations for an organization.'
)
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'integrations.manage'),
  ('admin', 'integrations.manage')
on conflict do nothing;

create table if not exists public.atlas_oauth_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  nonce_hash text not null,
  requested_permissions text[] not null check (cardinality(requested_permissions) > 0),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint atlas_oauth_states_expires_after_creation check (expires_at > created_at),
  constraint atlas_oauth_states_provider_nonce_unique unique (provider, nonce_hash)
);

comment on table public.atlas_oauth_states is
  'Short-lived anti-replay records for third-party OAuth flows. Raw nonces and provider tokens are never stored here.';

create index if not exists atlas_oauth_states_org_expires_idx
  on public.atlas_oauth_states (org_id, expires_at desc);

create index if not exists atlas_oauth_states_unconsumed_idx
  on public.atlas_oauth_states (provider, expires_at)
  where consumed_at is null;

alter table public.atlas_oauth_states enable row level security;

revoke all on public.atlas_oauth_states from anon, authenticated;
grant insert on public.atlas_oauth_states to authenticated;
grant all on public.atlas_oauth_states to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'atlas_oauth_states'
      and policyname = 'atlas_oauth_states_insert_authorized'
  ) then
    create policy atlas_oauth_states_insert_authorized
      on public.atlas_oauth_states
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and public.has_identity_permission(org_id, 'integrations.manage')
      );
  end if;
end
$$;
