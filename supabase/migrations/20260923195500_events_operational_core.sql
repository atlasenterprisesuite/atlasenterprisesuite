-- ATLAS Events & Entertainment operational core.
-- Internal event operations are organization-scoped. External ticket issuance,
-- payment capture and artist-booking execution remain fail-closed provider boundaries.

insert into public.identity_permissions(code,description)
values
  ('events.read','Read organization-scoped ATLAS Events records.'),
  ('events.write','Create and update internal event operations.'),
  ('events.settlement.read','Read event settlement records.'),
  ('events.settlement.write','Prepare internal settlement records.'),
  ('events.provider.manage','Manage external event provider configuration.')
on conflict(code) do update set description=excluded.description;

insert into public.identity_role_permissions(role,permission_code)
values
  ('owner','events.read'),('owner','events.write'),('owner','events.settlement.read'),
  ('owner','events.settlement.write'),('owner','events.provider.manage'),
  ('admin','events.read'),('admin','events.write'),('admin','events.settlement.read'),
  ('admin','events.settlement.write'),('admin','events.provider.manage'),
  ('viewer','events.read'),('viewer','events.settlement.read')
on conflict do nothing;

create table if not exists public.event_venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name))>0),
  address_json jsonb not null default '{}'::jsonb,
  capacity integer check(capacity is null or capacity>=0),
  source_reference text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenant_id=organization_id)
);

create table if not exists public.event_talent (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null check(length(trim(display_name))>0),
  contact_reference text,
  booking_status text not null default 'planned'
    check(booking_status in ('planned','contract_pending','contracted','cancelled')),
  contract_evidence_reference text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenant_id=organization_id),
  check(booking_status<>'contracted' or contract_evidence_reference is not null)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name))>0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue_id uuid references public.event_venues(id) on delete set null,
  capacity integer check(capacity is null or capacity>=0),
  lifecycle_status text not null default 'planned'
    check(lifecycle_status in ('planned','on_sale','live','closed','cancelled')),
  currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenant_id=organization_id),
  check(ends_at is null or ends_at>=starts_at)
);

create table if not exists public.event_talent_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  talent_id uuid not null references public.event_talent(id) on delete restrict,
  role_label text,
  planned_fee_cents bigint check(planned_fee_cents is null or planned_fee_cents>=0),
  created_at timestamptz not null default now(),
  unique(event_id,talent_id),
  check(tenant_id=organization_id)
);

create table if not exists public.event_production_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check(length(trim(title))>0),
  workstream text not null default 'general',
  status text not null default 'open' check(status in ('open','in_progress','blocked','complete','cancelled')),
  due_at timestamptz,
  owner_user_id uuid references auth.users(id),
  blocker_reason text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenant_id=organization_id),
  check(status='blocked' or blocker_reason is null)
);

create table if not exists public.event_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  counterparty_type text not null check(counterparty_type in ('talent','venue','vendor','promoter','other')),
  counterparty_reference text not null,
  gross_amount_cents bigint not null default 0 check(gross_amount_cents>=0),
  deductions_cents bigint not null default 0 check(deductions_cents>=0),
  net_amount_cents bigint generated always as (gross_amount_cents-deductions_cents) stored,
  status text not null default 'draft' check(status in ('draft','review','ready','payable','paid','disputed')),
  payment_evidence_reference text,
  accounting_reference text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(tenant_id=organization_id),
  check(gross_amount_cents>=deductions_cents),
  check(status<>'paid' or payment_evidence_reference is not null)
);

create table if not exists public.event_provider_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_type text not null check(provider_type in ('ticketing','payment','talent_booking','access')),
  provider_key text not null,
  state text not null default 'not_configured'
    check(state in ('not_configured','authorizing','verified','degraded','revoked','error')),
  provider_account_reference text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,provider_type,provider_key),
  check(tenant_id=organization_id),
  check(state<>'verified' or (provider_account_reference is not null and last_verified_at is not null))
);

create table if not exists public.event_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now(),
  check(tenant_id=organization_id)
);

create index if not exists events_org_start_idx on public.events(organization_id,starts_at);
create index if not exists event_tasks_event_status_idx on public.event_production_tasks(event_id,status);
create index if not exists event_settlements_event_status_idx on public.event_settlements(event_id,status);

create or replace function public.events_can_read(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_identity_permission(p_org_id,'events.read')
$$;

create or replace function public.events_can_write(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_identity_permission(p_org_id,'events.write')
$$;

grant execute on function public.events_can_read(uuid) to authenticated;
grant execute on function public.events_can_write(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'event_venues','event_talent','events','event_talent_assignments',
    'event_production_tasks','event_settlements','event_provider_connections','event_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','events_read_'||t,t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.events_can_read(organization_id))',
      'events_read_'||t,t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'event_venues','event_talent','events','event_talent_assignments','event_production_tasks'
  ] loop
    execute format('drop policy if exists %I on public.%I','events_write_'||t,t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.events_can_write(organization_id)) with check (public.events_can_write(organization_id) and tenant_id=organization_id)',
      'events_write_'||t,t
    );
  end loop;
end $$;

drop policy if exists event_settlements_browser_write on public.event_settlements;
create policy event_settlements_browser_write on public.event_settlements
for all to authenticated
using (public.has_identity_permission(organization_id,'events.settlement.write'))
with check (
  public.has_identity_permission(organization_id,'events.settlement.write')
  and tenant_id=organization_id
  and status<>'paid'
  and payment_evidence_reference is null
);

-- Provider verification is server-authoritative only. Browser clients may read but not
-- write event_provider_connections or event_audit_events.

create or replace function public.event_audit_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_org uuid := coalesce(new.organization_id,old.organization_id);
  v_tenant uuid := coalesce(new.tenant_id,old.tenant_id);
  v_id text := coalesce(new.id,old.id)::text;
begin
  insert into public.event_audit_events(
    tenant_id,organization_id,actor_user_id,entity_type,entity_id,action,before_json,after_json
  ) values (
    v_tenant,v_org,auth.uid(),tg_table_name,v_id,lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end $$;

do $$
declare t text;
declare n text;
begin
  foreach t in array array[
    'event_venues','event_talent','events','event_talent_assignments',
    'event_production_tasks','event_settlements'
  ] loop
    n:='audit_'||t;
    execute format('drop trigger if exists %I on public.%I',n,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.event_audit_mutation()',n,t);
  end loop;
end $$;
