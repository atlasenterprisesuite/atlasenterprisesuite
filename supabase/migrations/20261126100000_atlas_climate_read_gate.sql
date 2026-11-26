-- ATLAS Climate Resilience 777 — RUN 003: read-only authorization and atomic provider budget.
-- Existing control plane owns authentication; this database gate is callable by service_role only.

insert into public.identity_permissions (code, description)
values ('climate.read', 'Read organization-scoped climate evidence via an authenticated and rate-limited provider adapter.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'climate.read'),
  ('admin', 'climate.read'),
  ('manager', 'climate.read'),
  ('staff', 'climate.read')
on conflict do nothing;

create table if not exists public.atlas_climate_provider_read_quota (
  org_id uuid not null references public.organizations(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count between 0 and 6),
  last_requested_at timestamptz not null default now(),
  primary key (org_id, window_start)
);

alter table public.atlas_climate_provider_read_quota enable row level security;
revoke all on public.atlas_climate_provider_read_quota from public, anon, authenticated;
grant select, insert, update, delete on public.atlas_climate_provider_read_quota to service_role;
-- No browser RLS policy is defined. The only write path is the server-side quota RPC.

create or replace function public.atlas_climate_acquire_read_slot(p_org_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if p_org_id is null or p_user_id is null then
    raise exception 'climate_scope_required';
  end if;
  if not exists (
    select 1 from public.organization_members om
    join public.organizations o on o.id = om.org_id
    where om.org_id = p_org_id and om.user_id = p_user_id
      and om.status = 'active' and o.active = true
  ) then
    raise exception 'climate_membership_required';
  end if;

  -- Atomic upsert serializes concurrent callers within one org/minute bucket.
  insert into public.atlas_climate_provider_read_quota (org_id, window_start, request_count, last_requested_at)
  values (p_org_id, v_window, 1, now())
  on conflict (org_id, window_start) do update
    set request_count = public.atlas_climate_provider_read_quota.request_count + 1,
        last_requested_at = now()
  where public.atlas_climate_provider_read_quota.request_count < 6
  returning request_count into v_count;

  if v_count is null then
    return false;
  end if;

  -- Audit is in this same transaction. On audit failure, slot reservation rolls back.
  insert into public.audit_logs (org_id, user_id, action, table_name, record_id, new_data)
  values (p_org_id, p_user_id, 'climate.noaa.request.reserved', 'atlas_climate_provider_read_quota', null,
    jsonb_build_object('window_start', v_window, 'request_count', v_count, 'provider', 'NOAA/NWS'));

  return true;
end;
$$;

revoke all on function public.atlas_climate_acquire_read_slot(uuid, uuid) from public, anon, authenticated;
grant execute on function public.atlas_climate_acquire_read_slot(uuid, uuid) to service_role;

comment on function public.atlas_climate_acquire_read_slot(uuid, uuid) is
  'Authenticated control-plane gate only: 6 requests per organization per UTC minute; audit and quota update are atomic. No credentials or location are stored.';
