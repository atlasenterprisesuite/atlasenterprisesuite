begin;

insert into public.identity_permissions(code, description) values
  ('revenue.purchasing.read', 'Read vendors and purchase orders'),
  ('revenue.purchasing.manage', 'Manage vendors and purchase orders')
on conflict (code) do nothing;

insert into public.identity_role_permissions(role, permission_code)
select role_name, permission_code
from (values
  ('owner','revenue.purchasing.read'),('owner','revenue.purchasing.manage'),
  ('admin','revenue.purchasing.read'),('admin','revenue.purchasing.manage'),
  ('manager','revenue.purchasing.read'),('manager','revenue.purchasing.manage'),
  ('staff','revenue.purchasing.read'),
  ('viewer','revenue.purchasing.read')
) as defaults(role_name, permission_code)
on conflict do nothing;

insert into public.module_registry(code, family, display_name, status) values
  ('revenue.vendors', 'operations', 'Vendors', 'preview'),
  ('revenue.purchasing', 'operations', 'Purchasing', 'preview')
on conflict (code) do update set display_name = excluded.display_name, family = excluded.family;

create table public.revenue_vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 200),
  external_reference text,
  status text not null default 'active' check (status in ('active','inactive')),
  email text,
  phone text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade
);

create table public.revenue_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  vendor_id uuid not null,
  order_number text not null check (length(trim(order_number)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','approved','ordered','received','cancelled')),
  total_cents bigint not null default 0 check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, order_number),
  unique (id, tenant_id, org_id),
  foreign key (org_id, tenant_id) references public.organizations(id, tenant_id) on delete cascade,
  foreign key (vendor_id, tenant_id, org_id) references public.revenue_vendors(id, tenant_id, org_id) on delete restrict
);

create index revenue_vendors_scope_status_idx
  on public.revenue_vendors(tenant_id, org_id, status, name);
create index revenue_purchase_orders_scope_status_idx
  on public.revenue_purchase_orders(tenant_id, org_id, status, created_at desc);
create index revenue_purchase_orders_scope_vendor_idx
  on public.revenue_purchase_orders(tenant_id, org_id, vendor_id, created_at desc);

alter table public.revenue_vendors enable row level security;
alter table public.revenue_purchase_orders enable row level security;

create policy revenue_vendors_read_scope on public.revenue_vendors for select to authenticated
using (
  public.atlas_is_org_member(tenant_id, org_id)
  and public.has_identity_permission(tenant_id, org_id, 'revenue.purchasing.read')
);

create policy revenue_purchase_orders_read_scope on public.revenue_purchase_orders for select to authenticated
using (
  public.atlas_is_org_member(tenant_id, org_id)
  and public.has_identity_permission(tenant_id, org_id, 'revenue.purchasing.read')
);

revoke all on public.revenue_vendors, public.revenue_purchase_orders from anon, authenticated;
grant select on public.revenue_vendors, public.revenue_purchase_orders to authenticated;
grant all on public.revenue_vendors, public.revenue_purchase_orders to service_role;

create or replace function public.revenue_create_vendor(
  p_tenant_id uuid,
  p_org_id uuid,
  p_name text,
  p_external_reference text default null,
  p_email text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.atlas_is_org_member(p_tenant_id, p_org_id)
     or not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.purchasing.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_name,''))) = 0 then raise exception 'Vendor name required'; end if;

  insert into public.revenue_vendors(
    tenant_id, org_id, name, external_reference, email, phone, created_by
  ) values (
    p_tenant_id,
    p_org_id,
    trim(p_name),
    nullif(trim(coalesce(p_external_reference,'')),''),
    nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (
    p_tenant_id, p_org_id, v_actor,
    'revenue.purchasing.vendor.create', 'revenue_vendor', v_id::text,
    jsonb_build_object('name', trim(p_name), 'external_reference', p_external_reference)
  );

  return v_id;
end;
$$;

create or replace function public.revenue_create_purchase_order(
  p_tenant_id uuid,
  p_org_id uuid,
  p_vendor_id uuid,
  p_order_number text,
  p_total_cents bigint,
  p_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.atlas_is_org_member(p_tenant_id, p_org_id)
     or not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.purchasing.manage') then
    raise exception 'Permission denied';
  end if;
  if length(trim(coalesce(p_order_number,''))) = 0 then raise exception 'Purchase order number required'; end if;
  if p_total_cents < 0 then raise exception 'Purchase order total cannot be negative'; end if;

  insert into public.revenue_purchase_orders(
    tenant_id, org_id, vendor_id, order_number, total_cents, currency, created_by
  ) values (
    p_tenant_id, p_org_id, p_vendor_id, trim(p_order_number), p_total_cents, upper(p_currency), v_actor
  ) returning id into v_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, after_state)
  values (
    p_tenant_id, p_org_id, v_actor,
    'revenue.purchasing.po.create', 'revenue_purchase_order', v_id::text,
    jsonb_build_object('vendor_id', p_vendor_id, 'order_number', trim(p_order_number), 'total_cents', p_total_cents, 'currency', upper(p_currency))
  );

  return v_id;
end;
$$;

create or replace function public.revenue_transition_purchase_order(
  p_tenant_id uuid,
  p_org_id uuid,
  p_purchase_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_current text;
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(p_tenant_id, p_org_id, 'revenue.purchasing.manage') then
    raise exception 'Permission denied';
  end if;

  select status, to_jsonb(po)
    into v_current, v_before
    from public.revenue_purchase_orders po
   where po.id = p_purchase_order_id
     and po.tenant_id = p_tenant_id
     and po.org_id = p_org_id
   for update;

  if v_before is null then raise exception 'Purchase order not found'; end if;

  if not (
    (v_current = 'draft' and p_status in ('approved','cancelled')) or
    (v_current = 'approved' and p_status in ('ordered','cancelled')) or
    (v_current = 'ordered' and p_status in ('received','cancelled'))
  ) then
    raise exception 'Invalid purchase order transition from % to %', v_current, p_status;
  end if;

  update public.revenue_purchase_orders
     set status = p_status, updated_at = now()
   where id = p_purchase_order_id
     and tenant_id = p_tenant_id
     and org_id = p_org_id;

  select to_jsonb(po) into v_after
    from public.revenue_purchase_orders po
   where po.id = p_purchase_order_id
     and po.tenant_id = p_tenant_id
     and po.org_id = p_org_id;

  insert into public.audit_logs(tenant_id, org_id, actor_id, action, entity_type, entity_id, before_state, after_state)
  values (
    p_tenant_id, p_org_id, v_actor,
    'revenue.purchasing.po.transition', 'revenue_purchase_order', p_purchase_order_id::text,
    v_before, v_after
  );
end;
$$;

revoke all on function public.revenue_create_vendor(uuid,uuid,text,text,text,text) from public, anon;
revoke all on function public.revenue_create_purchase_order(uuid,uuid,uuid,text,bigint,text) from public, anon;
revoke all on function public.revenue_transition_purchase_order(uuid,uuid,uuid,text) from public, anon;

grant execute on function public.revenue_create_vendor(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.revenue_create_purchase_order(uuid,uuid,uuid,text,bigint,text) to authenticated;
grant execute on function public.revenue_transition_purchase_order(uuid,uuid,uuid,text) to authenticated;

commit;
