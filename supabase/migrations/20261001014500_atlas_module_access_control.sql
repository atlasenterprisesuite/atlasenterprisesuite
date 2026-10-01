-- ATLAS canonical module access control.
-- Presentation remains owned by apps/web/src/modules/registry.ts.
-- This migration owns the server-side organization entitlement + RBAC intersection.

create table if not exists public.atlas_module_access_rules (
  module_id text primary key check (module_id ~ '^[a-z0-9][a-z0-9-]*$'),
  permission_codes text[] not null default '{}'::text[],
  entitlement_required boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_module_entitlements (
  org_id uuid not null references public.organizations(id) on delete cascade,
  module_id text not null references public.atlas_module_access_rules(module_id) on update cascade on delete restrict,
  status text not null check (status in ('active','trial','suspended','revoked')),
  source text not null check (source in ('subscription','admin','billing_exempt','legacy_migration')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, module_id),
  check (valid_until is null or valid_until > valid_from)
);

create table if not exists public.atlas_module_entitlement_audit (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  module_id text not null,
  action text not null check (action in ('insert','update','delete')),
  actor_user_id uuid,
  old_row jsonb,
  new_row jsonb,
  created_at timestamptz not null default now()
);

insert into public.atlas_module_access_rules(module_id, permission_codes, entitlement_required, enabled)
values
  ('cloud', '{}'::text[], true, true),
  ('work', '{}'::text[], true, true),
  ('automations', '{}'::text[], true, true),
  ('assistant', '{}'::text[], true, true),
  ('knowledge', '{}'::text[], true, true),
  ('business', '{}'::text[], true, true),
  ('finance', array['accounting.read','accounting.write','accounting.post','accounting.close','accounting.admin'], true, true),
  ('accounting', array['accounting.read','accounting.write','accounting.post','accounting.close','accounting.admin'], true, true),
  ('revenue', array['accounting.read','accounting.write','accounting.admin','crm.read','crm.admin','commerce.read','commerce.admin'], true, true),
  ('advisory', array['advisory.read','advisory.manage','advisory.write','advisory.billing','advisory.compliance','advisory.automations','advisory.admin'], true, true),
  ('tax', array['tax.read','tax.prepare','tax.review','tax.file','tax.admin'], true, true),
  ('crm', array['crm.read','crm.sync','crm.admin'], true, true),
  ('commerce', array['commerce.read','commerce.catalog.read','commerce.catalog.manage','commerce.orders.read','commerce.orders.manage','commerce.promotions.manage','commerce.storefront.manage','commerce.fulfillment.manage','commerce.returns.manage','commerce.refund','commerce.analytics.read','commerce.admin'], true, true),
  ('inventory', '{}'::text[], true, true),
  ('analytics', array['analytics.read','analytics.manage','analytics.export','analytics.admin'], true, true),
  ('connect', '{}'::text[], true, true),
  ('telecom', '{}'::text[], true, true),
  ('people', array['hr.read','hr.write','payroll.read','payroll.write','payroll.approve','payroll.self'], true, true),
  ('payroll', array['payroll.read','payroll.write','payroll.approve','payroll.self'], true, true),
  ('learning', '{}'::text[], true, true),
  ('health', '{}'::text[], true, true),
  ('insurance', '{}'::text[], true, true),
  ('studio', '{}'::text[], true, true),
  ('site-review', '{}'::text[], true, true),
  ('voice', array['voice.personal.read','voice.personal.create','voice.personal.record','voice.personal.generate','voice.personal.use','voice.personal.delete','voice.apple.request','voice.apple.use','voice.integration.manage','voice.transcript.read'], true, true),
  ('events', '{}'::text[], true, true),
  ('frontier', array['frontier.read','frontier.play','frontier.manage'], true, true),
  ('hospitality', '{}'::text[], true, true),
  ('ride', '{}'::text[], true, true),
  ('gps', '{}'::text[], true, true),
  ('aviation', '{}'::text[], true, true),
  ('galaxy', '{}'::text[], true, true),
  ('device-os', '{}'::text[], true, true),
  ('release-control', '{}'::text[], true, true),
  ('execution', '{}'::text[], true, true)
on conflict (module_id) do update set
  permission_codes = excluded.permission_codes,
  entitlement_required = excluded.entitlement_required,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function private.audit_atlas_module_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.atlas_module_entitlement_audit(
    org_id,
    module_id,
    action,
    actor_user_id,
    old_row,
    new_row
  )
  values (
    coalesce(new.org_id, old.org_id),
    coalesce(new.module_id, old.module_id),
    lower(tg_op),
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_module_entitlements_audit on public.atlas_module_entitlements;
create trigger atlas_module_entitlements_audit
after insert or update or delete on public.atlas_module_entitlements
for each row execute function private.audit_atlas_module_entitlement();

-- Preserve the effective module availability existing organizations had before
-- this entitlement layer. New organizations remain fail-closed until provisioned.
insert into public.atlas_module_entitlements(org_id, module_id, status, source, metadata)
select o.id, r.module_id, 'active', 'legacy_migration', jsonb_build_object('reason','preserve_pre_entitlement_access')
from public.organizations o
cross join public.atlas_module_access_rules r
where o.active = true
  and r.enabled = true
on conflict (org_id, module_id) do nothing;

create or replace function public.atlas_module_access_snapshot()
returns table (
  module_id text,
  allowed boolean,
  reason text,
  entitlement_status text,
  permission_granted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_role text;
begin
  if v_user_id is null then
    return;
  end if;

  select om.org_id, om.role
    into v_org_id, v_role
  from public.organization_members om
  join public.organizations o on o.id = om.org_id
  where om.user_id = v_user_id
    and om.status = 'active'
    and o.active = true
  limit 1;

  if v_org_id is null then
    return;
  end if;

  return query
  with access_state as (
    select
      r.module_id,
      r.entitlement_required,
      e.status as entitlement_status,
      (
        e.status in ('active','trial')
        and e.valid_from <= now()
        and (e.valid_until is null or e.valid_until > now())
      ) as entitlement_ok,
      (
        cardinality(r.permission_codes) = 0
        or exists (
          select 1
          from public.identity_role_permissions rp
          where rp.role = v_role
            and rp.permission_code = any(r.permission_codes)
        )
      ) as permission_ok
    from public.atlas_module_access_rules r
    left join public.atlas_module_entitlements e
      on e.org_id = v_org_id
     and e.module_id = r.module_id
    where r.enabled = true
  )
  select
    s.module_id,
    ((not s.entitlement_required or coalesce(s.entitlement_ok,false)) and s.permission_ok) as allowed,
    case
      when s.entitlement_required and s.entitlement_status is null then 'entitlement_required'
      when s.entitlement_required and not coalesce(s.entitlement_ok,false) then 'entitlement_inactive'
      when not s.permission_ok then 'permission_denied'
      else 'allowed'
    end as reason,
    s.entitlement_status,
    s.permission_ok as permission_granted
  from access_state s
  order by s.module_id;
end;
$$;

alter table public.atlas_module_access_rules enable row level security;
alter table public.atlas_module_entitlements enable row level security;
alter table public.atlas_module_entitlement_audit enable row level security;

revoke all on public.atlas_module_access_rules from public, anon, authenticated;
revoke all on public.atlas_module_entitlements from public, anon, authenticated;
revoke all on public.atlas_module_entitlement_audit from public, anon, authenticated;
revoke all on function public.atlas_module_access_snapshot() from public, anon;
grant execute on function public.atlas_module_access_snapshot() to authenticated;

comment on function public.atlas_module_access_snapshot() is
  'Returns the authenticated user module-access intersection: active organization entitlement AND applicable role permission. Empty permission rules preserve membership-based legacy behavior while backend/RLS permissions remain authoritative.';
