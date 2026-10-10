-- Persist explicit organization authorization for Advisory external-provider capabilities.
-- This records permission to connect a provider; it never claims a provider is connected or verified.

create table if not exists public.advisory_provider_authorizations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  capability text not null check (capability in (
    'esign',
    'print_fulfillment',
    'paid_media',
    'payment',
    'publishing'
  )),
  authorized boolean not null default true,
  authorization_source text not null check (length(trim(authorization_source)) > 0),
  authorization_reference text,
  authorized_by uuid references auth.users(id) on delete set null,
  authorized_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, capability),
  check (
    (authorized and revoked_at is null)
    or
    (not authorized and revoked_at is not null)
  )
);

comment on table public.advisory_provider_authorizations is
  'Firm-scoped organizational approval to connect an external provider capability. Authorization does not imply provider connectivity or verification.';

create index if not exists advisory_provider_authorizations_scope_idx
  on public.advisory_provider_authorizations(org_id, firm_id, capability, authorized);

alter table public.advisory_provider_authorizations enable row level security;

revoke all on public.advisory_provider_authorizations from anon, authenticated;
grant select on public.advisory_provider_authorizations to authenticated;
grant all on public.advisory_provider_authorizations to service_role;

drop policy if exists advisory_provider_authorizations_read
  on public.advisory_provider_authorizations;

create policy advisory_provider_authorizations_read
on public.advisory_provider_authorizations
for select
to authenticated
using (
  public.has_identity_permission(org_id, 'advisory.read')
  and public.is_advisory_firm_member(org_id, firm_id)
);

create or replace function public.advisory_validate_provider_authorization_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org uuid;
begin
  select f.org_id into v_org
  from public.advisory_firms f
  where f.id = new.firm_id;

  if v_org is null or v_org <> new.org_id then
    raise exception 'advisory_provider_authorization_scope_invalid';
  end if;

  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.advisory_validate_provider_authorization_scope() from public, anon, authenticated;

drop trigger if exists advisory_provider_authorization_scope_check
  on public.advisory_provider_authorizations;

create trigger advisory_provider_authorization_scope_check
before insert or update
on public.advisory_provider_authorizations
for each row
execute function public.advisory_validate_provider_authorization_scope();

create or replace function public.advisory_audit_provider_authorization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_action text;
  v_org uuid;
  v_firm uuid;
  v_id uuid;
  v_actor uuid;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_org := old.org_id;
    v_firm := old.firm_id;
    v_id := old.id;
    v_actor := coalesce(auth.uid(), old.authorized_by);
  elsif tg_op = 'INSERT' then
    v_action := 'insert';
    v_org := new.org_id;
    v_firm := new.firm_id;
    v_id := new.id;
    v_actor := coalesce(auth.uid(), new.authorized_by);
  else
    v_action := 'update';
    v_org := new.org_id;
    v_firm := new.firm_id;
    v_id := new.id;
    v_actor := coalesce(auth.uid(), new.authorized_by, old.authorized_by);
  end if;

  insert into public.advisory_audit_events(
    org_id,
    firm_id,
    entity_type,
    entity_id,
    action,
    actor_user_id
  )
  values (
    v_org,
    v_firm,
    'provider_authorization',
    v_id,
    v_action,
    v_actor
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function public.advisory_audit_provider_authorization() from public, anon, authenticated;

drop trigger if exists advisory_provider_authorization_audit
  on public.advisory_provider_authorizations;

create trigger advisory_provider_authorization_audit
after insert or update or delete
on public.advisory_provider_authorizations
for each row
execute function public.advisory_audit_provider_authorization();

create or replace function public.advisory_set_provider_authorization(
  p_firm_id uuid,
  p_capability text,
  p_authorized boolean,
  p_reference text default null
)
returns setof public.advisory_provider_authorizations
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_org is null then raise exception 'Active organization required'; end if;
  if p_capability not in ('esign','print_fulfillment','paid_media','payment','publishing') then
    raise exception 'advisory_provider_capability_invalid';
  end if;
  if not (
    public.has_identity_permission(v_org, 'advisory.manage')
    or public.has_identity_permission(v_org, 'advisory.admin')
  ) then
    raise exception 'Advisory manage permission required';
  end if;
  if not public.is_advisory_firm_member(v_org, p_firm_id) then
    raise exception 'Advisory firm membership required';
  end if;

  insert into public.advisory_provider_authorizations(
    org_id,
    firm_id,
    capability,
    authorized,
    authorization_source,
    authorization_reference,
    authorized_by,
    authorized_at,
    revoked_at
  )
  values (
    v_org,
    p_firm_id,
    p_capability,
    p_authorized,
    'in_app_authorization',
    nullif(trim(coalesce(p_reference,'')), ''),
    v_user,
    now(),
    case when p_authorized then null else now() end
  )
  on conflict (firm_id, capability) do update
  set authorized = excluded.authorized,
      authorization_source = excluded.authorization_source,
      authorization_reference = excluded.authorization_reference,
      authorized_by = excluded.authorized_by,
      authorized_at = excluded.authorized_at,
      revoked_at = excluded.revoked_at,
      updated_at = now();

  return query
  select a.*
  from public.advisory_provider_authorizations a
  where a.firm_id = p_firm_id
    and a.capability = p_capability;
end
$$;

revoke all on function public.advisory_set_provider_authorization(uuid,text,boolean,text) from public, anon;
grant execute on function public.advisory_set_provider_authorization(uuid,text,boolean,text) to authenticated;
