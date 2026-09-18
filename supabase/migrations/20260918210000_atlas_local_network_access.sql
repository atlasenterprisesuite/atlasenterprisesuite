-- ATLAS Device OS · Local Network Access governance.
-- Browser LNA remains a user-agent permission. ATLAS adds an organization-scoped
-- allowlist and immutable operational evidence without storing local payloads,
-- device credentials, or network-discovery results.

insert into public.identity_permissions (code, description)
values
  ('device.local.read', 'Read organization-scoped local-network endpoint configuration and evidence.'),
  ('device.local.use', 'Run governed browser probes against explicitly allowlisted local-network endpoints.'),
  ('device.local.admin', 'Create, change, disable, and remove local-network endpoint allowlist entries.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'device.local.read'),
  ('owner', 'device.local.use'),
  ('owner', 'device.local.admin'),
  ('admin', 'device.local.read'),
  ('admin', 'device.local.use'),
  ('admin', 'device.local.admin')
on conflict do nothing;

create table if not exists public.atlas_local_network_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  origin text not null,
  address_space text not null check (address_space in ('local', 'loopback')),
  probe_path text not null default '/' check (
    left(probe_path, 1) = '/'
    and probe_path !~ '[[:space:]]'
    and probe_path !~ '^[[:space:]]*//'
  ),
  enabled boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_local_network_endpoints_origin_shape check (
    origin ~ '^https?://[^/@[:space:]]+(:[0-9]+)?$'
    and origin not like '%@%'
  ),
  constraint atlas_local_network_endpoints_org_origin_key unique (org_id, origin)
);

comment on table public.atlas_local_network_endpoints is
  'Explicit organization allowlist for browser-originated ATLAS Local Network Access. No discovery data or credentials are stored.';

create table if not exists public.atlas_local_network_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_id uuid references public.atlas_local_network_endpoints(id) on delete set null,
  actor_user_id uuid not null default auth.uid() references auth.users(id),
  event_type text not null check (
    event_type in (
      'probe_requested',
      'probe_succeeded',
      'probe_failed',
      'blocked_by_atlas',
      'permission_denied'
    )
  ),
  origin text not null,
  success boolean,
  http_status integer check (http_status is null or http_status between 100 and 599),
  error_code text,
  created_at timestamptz not null default now()
);

comment on table public.atlas_local_network_events is
  'Append-only ATLAS LNA evidence. Payloads, authorization headers, cookies, and device credentials are prohibited.';

create index if not exists atlas_local_network_endpoints_org_enabled_idx
  on public.atlas_local_network_endpoints (org_id, enabled, created_at);

create index if not exists atlas_local_network_events_org_created_idx
  on public.atlas_local_network_events (org_id, created_at desc);

alter table public.atlas_local_network_endpoints enable row level security;
alter table public.atlas_local_network_events enable row level security;

revoke all on public.atlas_local_network_endpoints from anon;
revoke all on public.atlas_local_network_events from anon;
revoke all on public.atlas_local_network_events from authenticated;

grant select, insert, update, delete on public.atlas_local_network_endpoints to authenticated;
grant select, insert on public.atlas_local_network_events to authenticated;
grant all on public.atlas_local_network_endpoints to service_role;
grant all on public.atlas_local_network_events to service_role;

drop policy if exists atlas_local_network_endpoints_read on public.atlas_local_network_endpoints;
create policy atlas_local_network_endpoints_read
  on public.atlas_local_network_endpoints
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'device.local.read')
    or public.has_identity_permission(org_id, 'device.local.use')
    or public.has_identity_permission(org_id, 'device.local.admin')
  );

drop policy if exists atlas_local_network_endpoints_insert on public.atlas_local_network_endpoints;
create policy atlas_local_network_endpoints_insert
  on public.atlas_local_network_endpoints
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and updated_by = auth.uid()
    and public.has_identity_permission(org_id, 'device.local.admin')
  );

drop policy if exists atlas_local_network_endpoints_update on public.atlas_local_network_endpoints;
create policy atlas_local_network_endpoints_update
  on public.atlas_local_network_endpoints
  for update
  to authenticated
  using (public.has_identity_permission(org_id, 'device.local.admin'))
  with check (
    updated_by = auth.uid()
    and public.has_identity_permission(org_id, 'device.local.admin')
  );

drop policy if exists atlas_local_network_endpoints_delete on public.atlas_local_network_endpoints;
create policy atlas_local_network_endpoints_delete
  on public.atlas_local_network_endpoints
  for delete
  to authenticated
  using (public.has_identity_permission(org_id, 'device.local.admin'));

drop policy if exists atlas_local_network_events_read on public.atlas_local_network_events;
create policy atlas_local_network_events_read
  on public.atlas_local_network_events
  for select
  to authenticated
  using (
    public.has_identity_permission(org_id, 'device.local.read')
    or public.has_identity_permission(org_id, 'device.local.admin')
  );

drop policy if exists atlas_local_network_events_insert on public.atlas_local_network_events;
create policy atlas_local_network_events_insert
  on public.atlas_local_network_events
  for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and (
      public.has_identity_permission(org_id, 'device.local.use')
      or public.has_identity_permission(org_id, 'device.local.admin')
    )
  );
