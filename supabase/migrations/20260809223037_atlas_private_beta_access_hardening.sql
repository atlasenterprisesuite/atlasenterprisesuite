begin;

create table if not exists public.atlas_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.atlas_platform_admins enable row level security;
revoke all on table public.atlas_platform_admins from public, anon, authenticated;

comment on table public.atlas_platform_admins is
  'Server-only allowlist for ATLAS platform bootstrap administrators. No direct browser access.';

do $$
declare
  existing_admins integer;
  existing_users integer;
  bootstrap_user uuid;
begin
  select count(*) into existing_admins
  from public.atlas_platform_admins
  where enabled = true;

  if existing_admins = 0 then
    select count(*) into existing_users from auth.users;
    if existing_users <> 1 then
      raise exception 'ATLAS Private Beta bootstrap requires exactly one pre-existing Auth user when no platform admin exists';
    end if;

    select id into bootstrap_user
    from auth.users
    order by created_at asc
    limit 1;

    insert into public.atlas_platform_admins(user_id, enabled, created_by)
    values (bootstrap_user, true, bootstrap_user)
    on conflict (user_id) do update set enabled = true;
  end if;
end
$$;

create or replace function public.create_organization(
  organization_name text,
  organization_legal_name text default null,
  organization_industry text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  organization_uuid uuid;
  confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select email_confirmed_at into confirmed_at
  from auth.users
  where id = auth.uid();

  if confirmed_at is null then
    raise exception 'A confirmed email is required';
  end if;

  if not exists (
    select 1
    from public.atlas_platform_admins admin
    where admin.user_id = auth.uid()
      and admin.enabled = true
  ) then
    raise exception 'ATLAS Private Beta organization bootstrap is restricted to a platform administrator';
  end if;

  organization_name := btrim(coalesce(organization_name, ''));
  organization_legal_name := nullif(btrim(coalesce(organization_legal_name, '')), '');
  organization_industry := nullif(btrim(coalesce(organization_industry, '')), '');

  if length(organization_name) < 2 or length(organization_name) > 160 then
    raise exception 'Organization name must contain between 2 and 160 characters';
  end if;
  if organization_legal_name is not null and length(organization_legal_name) > 240 then
    raise exception 'Organization legal name is too long';
  end if;
  if organization_industry is not null and length(organization_industry) > 160 then
    raise exception 'Organization industry is too long';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('atlas:platform-bootstrap:' || auth.uid()::text, 0));

  insert into public.organizations(name, legal_name, industry, created_by)
  values (organization_name, organization_legal_name, organization_industry, auth.uid())
  returning id into organization_uuid;

  insert into public.organization_members(org_id, user_id, role, status, created_at, updated_at)
  values (organization_uuid, auth.uid(), 'owner', 'active', now(), now());

  insert into public.organization_settings(org_id)
  values (organization_uuid);

  insert into public.organization_modules(org_id, module_code, enabled, launch_status)
  values
    (organization_uuid, 'core', true, 'active'),
    (organization_uuid, 'crm', true, 'beta'),
    (organization_uuid, 'accounting', true, 'beta'),
    (organization_uuid, 'inventory', true, 'beta'),
    (organization_uuid, 'hr', true, 'beta');

  insert into public.chart_of_accounts(org_id, account_number, name, account_type)
  values
    (organization_uuid, '1000', 'Cash', 'asset'),
    (organization_uuid, '1100', 'Accounts Receivable', 'asset'),
    (organization_uuid, '2000', 'Accounts Payable', 'liability'),
    (organization_uuid, '4000', 'Revenue', 'revenue'),
    (organization_uuid, '5000', 'Expenses', 'expense');

  return organization_uuid;
end;
$$;

revoke execute on function public.create_organization(text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text) to authenticated;

commit;
