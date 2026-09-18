-- ATLAS Advisory Office durable persistence.
-- Organization scope is derived from the authenticated ATLAS identity. Browser callers never supply org_id to write RPCs.

insert into public.identity_permissions (code, description)
values
  ('advisory.read', 'Read Advisory Office firm, client, engagement and launch records.'),
  ('advisory.manage', 'Create and manage Advisory Office clients, engagements and launch evidence.'),
  ('advisory.write', 'Legacy-compatible Advisory Office write permission.'),
  ('advisory.billing', 'Manage Advisory billing references and approval-bound billing workflows.'),
  ('advisory.compliance', 'Manage Advisory compliance records and reviews.'),
  ('advisory.automations', 'Manage Advisory automation rules.'),
  ('advisory.admin', 'Administer Advisory Office configuration.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','advisory.read'), ('owner','advisory.manage'), ('owner','advisory.write'),
  ('owner','advisory.billing'), ('owner','advisory.compliance'), ('owner','advisory.automations'), ('owner','advisory.admin'),
  ('admin','advisory.read'), ('admin','advisory.manage'), ('admin','advisory.write'),
  ('admin','advisory.billing'), ('admin','advisory.compliance'), ('admin','advisory.automations'), ('admin','advisory.admin'),
  ('viewer','advisory.read')
on conflict do nothing;

create table if not exists public.advisory_firms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null check (length(trim(slug)) > 0),
  firm_number text not null check (length(trim(firm_number)) > 0),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'active' check (status in ('active','inactive')),
  platform text not null default 'ATLAS Advisory Office' check (platform = 'ATLAS Advisory Office'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug),
  unique (org_id, firm_number)
);

create table if not exists public.advisory_firm_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'firm_owner','firm_admin','advisor','accountant_bookkeeper','reviewer',
    'staff','billing','client','client_delegate','read_only_auditor'
  )),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create table if not exists public.advisory_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  client_type text not null default 'business' check (client_type in ('person','business')),
  email text,
  phone text,
  status text not null default 'active' check (status in ('prospect','active','inactive')),
  owner_id uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advisory_engagements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  client_id uuid not null references public.advisory_clients(id) on delete cascade,
  service_id text not null check (length(trim(service_id)) > 0),
  title text not null check (length(trim(title)) > 0),
  status text not null default 'open' check (status in ('lead','open','review','billing','closed')),
  owner_id uuid references auth.users(id),
  starts_on date,
  due_on date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);

create table if not exists public.advisory_launch_deliverables (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  engagement_id uuid not null references public.advisory_engagements(id) on delete cascade,
  dimension text not null check (dimension in (
    'business_setup','brand','website','contact_channels','crm',
    'payments','accounting','marketing','compliance','analytics'
  )),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  evidence_reference text,
  note text,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, dimension),
  check (status <> 'verified' or length(trim(coalesce(evidence_reference,''))) > 0)
);

create table if not exists public.advisory_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists advisory_firms_org_idx on public.advisory_firms(org_id, status);
create index if not exists advisory_clients_firm_idx on public.advisory_clients(org_id, firm_id, status, display_name);
create index if not exists advisory_engagements_firm_idx on public.advisory_engagements(org_id, firm_id, status, created_at desc);
create index if not exists advisory_engagements_client_idx on public.advisory_engagements(client_id, status);
create index if not exists advisory_launch_engagement_idx on public.advisory_launch_deliverables(engagement_id, dimension);
create index if not exists advisory_audit_org_idx on public.advisory_audit_events(org_id, firm_id, created_at desc);

alter table public.advisory_firms enable row level security;
alter table public.advisory_firm_memberships enable row level security;
alter table public.advisory_clients enable row level security;
alter table public.advisory_engagements enable row level security;
alter table public.advisory_launch_deliverables enable row level security;
alter table public.advisory_audit_events enable row level security;

drop policy if exists advisory_firms_read on public.advisory_firms;
create policy advisory_firms_read on public.advisory_firms for select to authenticated
using (public.has_identity_permission(org_id, 'advisory.read'));

drop policy if exists advisory_memberships_read on public.advisory_firm_memberships;
create policy advisory_memberships_read on public.advisory_firm_memberships for select to authenticated
using (user_id = auth.uid() or public.has_identity_permission(org_id, 'advisory.manage'));

drop policy if exists advisory_clients_read on public.advisory_clients;
create policy advisory_clients_read on public.advisory_clients for select to authenticated
using (public.has_identity_permission(org_id, 'advisory.read'));

drop policy if exists advisory_engagements_read on public.advisory_engagements;
create policy advisory_engagements_read on public.advisory_engagements for select to authenticated
using (public.has_identity_permission(org_id, 'advisory.read'));

drop policy if exists advisory_launch_read on public.advisory_launch_deliverables;
create policy advisory_launch_read on public.advisory_launch_deliverables for select to authenticated
using (public.has_identity_permission(org_id, 'advisory.read'));

drop policy if exists advisory_audit_read on public.advisory_audit_events;
create policy advisory_audit_read on public.advisory_audit_events for select to authenticated
using (public.has_identity_permission(org_id, 'advisory.admin') or public.has_identity_permission(org_id, 'audit.read'));

revoke all on public.advisory_firms from anon, authenticated;
revoke all on public.advisory_firm_memberships from anon, authenticated;
revoke all on public.advisory_clients from anon, authenticated;
revoke all on public.advisory_engagements from anon, authenticated;
revoke all on public.advisory_launch_deliverables from anon, authenticated;
revoke all on public.advisory_audit_events from anon, authenticated;

grant select on public.advisory_firms to authenticated;
grant select on public.advisory_firm_memberships to authenticated;
grant select on public.advisory_clients to authenticated;
grant select on public.advisory_engagements to authenticated;
grant select on public.advisory_launch_deliverables to authenticated;
grant select on public.advisory_audit_events to authenticated;
grant all on public.advisory_firms, public.advisory_firm_memberships, public.advisory_clients,
  public.advisory_engagements, public.advisory_launch_deliverables, public.advisory_audit_events to service_role;

create or replace function public.advisory_actor_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.status = 'active'
  order by om.org_id
  limit 1
$$;

revoke all on function public.advisory_actor_org() from public;
grant execute on function public.advisory_actor_org() to authenticated;

create or replace function public.advisory_bootstrap_default_firm()
returns setof public.advisory_firms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_firm uuid;
  v_org_role text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_org is null then raise exception 'Active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then
    raise exception 'Advisory manage permission required';
  end if;

  select om.role into v_org_role
  from public.organization_members om
  where om.org_id = v_org and om.user_id = v_user and om.status = 'active'
  limit 1;

  insert into public.advisory_firms(org_id, slug, firm_number, name, status, platform, created_by)
  values (v_org, 'aw-finance-advisory-solutions', '001', 'AW Finance Advisory Solutions', 'active', 'ATLAS Advisory Office', v_user)
  on conflict (org_id, slug) do nothing;

  select f.id into v_firm
  from public.advisory_firms f
  where f.org_id = v_org and f.slug = 'aw-finance-advisory-solutions';

  insert into public.advisory_firm_memberships(org_id, firm_id, user_id, role, status)
  values (v_org, v_firm, v_user, case when v_org_role = 'owner' then 'firm_owner' else 'firm_admin' end, 'active')
  on conflict (firm_id, user_id) do nothing;

  return query
  select f.* from public.advisory_firms f where f.id = v_firm;
end
$$;

create or replace function public.advisory_create_client(
  p_firm_id uuid,
  p_display_name text,
  p_email text default null,
  p_phone text default null,
  p_client_type text default 'business'
)
returns setof public.advisory_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_client uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;
  if not exists (select 1 from public.advisory_firms f where f.id = p_firm_id and f.org_id = v_org and f.status = 'active') then
    raise exception 'Firm not available in active organization';
  end if;
  if length(trim(coalesce(p_display_name,''))) = 0 then raise exception 'Client name required'; end if;
  if p_client_type not in ('person','business') then raise exception 'Invalid client type'; end if;

  insert into public.advisory_clients(org_id, firm_id, display_name, client_type, email, phone, status, owner_id, created_by)
  values (v_org, p_firm_id, trim(p_display_name), p_client_type, nullif(trim(coalesce(p_email,'')),''), nullif(trim(coalesce(p_phone,'')),''), 'active', v_user, v_user)
  returning id into v_client;

  return query select c.* from public.advisory_clients c where c.id = v_client;
end
$$;

create or replace function public.advisory_create_engagement(
  p_firm_id uuid,
  p_client_id uuid,
  p_service_id text,
  p_title text
)
returns setof public.advisory_engagements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_engagement uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;
  if not exists (select 1 from public.advisory_firms f where f.id = p_firm_id and f.org_id = v_org and f.status = 'active') then
    raise exception 'Firm not available in active organization';
  end if;
  if not exists (select 1 from public.advisory_clients c where c.id = p_client_id and c.org_id = v_org and c.firm_id = p_firm_id and c.status <> 'inactive') then
    raise exception 'Client not available in firm';
  end if;
  if length(trim(coalesce(p_service_id,''))) = 0 or length(trim(coalesce(p_title,''))) = 0 then
    raise exception 'Service and title required';
  end if;

  insert into public.advisory_engagements(org_id, firm_id, client_id, service_id, title, status, owner_id, created_by)
  values (v_org, p_firm_id, p_client_id, trim(p_service_id), trim(p_title), 'open', v_user, v_user)
  returning id into v_engagement;

  return query select e.* from public.advisory_engagements e where e.id = v_engagement;
end
$$;

create or replace function public.advisory_set_launch_evidence(
  p_engagement_id uuid,
  p_dimension text,
  p_status text,
  p_evidence_reference text default null,
  p_note text default null
)
returns setof public.advisory_launch_deliverables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_firm uuid;
  v_service text;
  v_row uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;

  select e.firm_id, e.service_id into v_firm, v_service
  from public.advisory_engagements e
  where e.id = p_engagement_id and e.org_id = v_org;

  if v_firm is null then raise exception 'Engagement not available in active organization'; end if;
  if v_service <> 'business-launch-360' then raise exception 'Launch evidence requires Business Launch 360 engagement'; end if;
  if p_dimension not in ('business_setup','brand','website','contact_channels','crm','payments','accounting','marketing','compliance','analytics') then
    raise exception 'Invalid readiness dimension';
  end if;
  if p_status not in ('pending','verified','rejected') then raise exception 'Invalid evidence status'; end if;
  if p_status = 'verified' and length(trim(coalesce(p_evidence_reference,''))) = 0 then
    raise exception 'Verified evidence requires a reference';
  end if;

  insert into public.advisory_launch_deliverables(
    org_id, firm_id, engagement_id, dimension, status, evidence_reference, note,
    verified_by, verified_at, updated_by
  )
  values (
    v_org, v_firm, p_engagement_id, p_dimension, p_status,
    nullif(trim(coalesce(p_evidence_reference,'')),''),
    nullif(trim(coalesce(p_note,'')),''),
    case when p_status = 'verified' then v_user else null end,
    case when p_status = 'verified' then now() else null end,
    v_user
  )
  on conflict (engagement_id, dimension) do update
  set status = excluded.status,
      evidence_reference = excluded.evidence_reference,
      note = excluded.note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning id into v_row;

  return query select d.* from public.advisory_launch_deliverables d where d.id = v_row;
end
$$;

create or replace function public.advisory_log_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := case when tg_op = 'DELETE' then old.org_id else new.org_id end;
  v_firm uuid := case when tg_op = 'DELETE' then old.firm_id else new.firm_id end;
  v_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
begin
  insert into public.advisory_audit_events(org_id, firm_id, entity_type, entity_id, action, actor_user_id)
  values (v_org, v_firm, tg_table_name, v_id, lower(tg_op), auth.uid());
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists advisory_clients_audit on public.advisory_clients;
create trigger advisory_clients_audit after insert or update or delete on public.advisory_clients
for each row execute function public.advisory_log_audit();

drop trigger if exists advisory_engagements_audit on public.advisory_engagements;
create trigger advisory_engagements_audit after insert or update or delete on public.advisory_engagements
for each row execute function public.advisory_log_audit();

drop trigger if exists advisory_launch_audit on public.advisory_launch_deliverables;
create trigger advisory_launch_audit after insert or update or delete on public.advisory_launch_deliverables
for each row execute function public.advisory_log_audit();

revoke all on function public.advisory_bootstrap_default_firm() from public;
revoke all on function public.advisory_create_client(uuid,text,text,text,text) from public;
revoke all on function public.advisory_create_engagement(uuid,uuid,text,text) from public;
revoke all on function public.advisory_set_launch_evidence(uuid,text,text,text,text) from public;

grant execute on function public.advisory_bootstrap_default_firm() to authenticated;
grant execute on function public.advisory_create_client(uuid,text,text,text,text) to authenticated;
grant execute on function public.advisory_create_engagement(uuid,uuid,text,text) to authenticated;
grant execute on function public.advisory_set_launch_evidence(uuid,text,text,text,text) to authenticated;

comment on table public.advisory_firms is 'ATLAS Advisory Office firms. Firm #001 is bootstrapped only for the authenticated active organization.';
comment on table public.advisory_clients is 'Organization and firm scoped Advisory clients. No seed clients are created.';
comment on table public.advisory_engagements is 'Engagement source of truth for Advisory service delivery. Financial ledger state remains in Accounting.';
comment on table public.advisory_launch_deliverables is 'Evidence records for Business Launch 360 readiness. Verified status requires a real evidence reference.';
