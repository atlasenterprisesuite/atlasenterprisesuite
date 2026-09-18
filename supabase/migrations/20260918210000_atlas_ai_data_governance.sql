-- ATLAS AI data governance: organization-scoped provider storage policy + immutable audit trail.
-- Provider-side storage is fail-closed. Sensitive modules are additionally blocked in the runtime policy engine.

insert into public.identity_permissions (code, description)
values
  ('security.read', 'Read ATLAS Security Center and AI data-governance policy.'),
  ('security.manage', 'Manage ATLAS Security Center and AI data-governance policy.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner','security.read'), ('owner','security.manage'),
  ('admin','security.read'), ('admin','security.manage'),
  ('viewer','security.read')
on conflict do nothing;

create table if not exists public.atlas_ai_data_policies (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  audit_logging_enabled boolean not null default true check (audit_logging_enabled = true),
  provider_call_logging_mode text not null default 'disabled'
    check (provider_call_logging_mode in ('disabled','per_call','all','selected_modules')),
  selected_modules text[] not null default '{}'::text[],
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_ai_data_policies_sensitive_selection_check
    check (not (selected_modules && array['health','payroll','hr','finance','accounting','lawyer']::text[]))
);

create table if not exists public.atlas_ai_data_policy_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  action text not null check (action in ('insert','update')),
  previous_policy jsonb,
  resulting_policy jsonb not null,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists atlas_ai_data_policy_audit_org_created_idx
  on public.atlas_ai_data_policy_audit(org_id, created_at desc);

create or replace function public.atlas_ai_data_policy_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.audit_logging_enabled := true;
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end
$$;

create or replace function public.atlas_ai_data_policy_record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.atlas_ai_data_policy_audit(
    org_id,
    action,
    previous_policy,
    resulting_policy,
    actor_user_id
  )
  values (
    new.org_id,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    auth.uid()
  );
  return new;
end
$$;

drop trigger if exists atlas_ai_data_policy_before_write_trigger on public.atlas_ai_data_policies;
create trigger atlas_ai_data_policy_before_write_trigger
before insert or update on public.atlas_ai_data_policies
for each row execute function public.atlas_ai_data_policy_before_write();

drop trigger if exists atlas_ai_data_policy_audit_trigger on public.atlas_ai_data_policies;
create trigger atlas_ai_data_policy_audit_trigger
after insert or update on public.atlas_ai_data_policies
for each row execute function public.atlas_ai_data_policy_record_audit();

alter table public.atlas_ai_data_policies enable row level security;
alter table public.atlas_ai_data_policy_audit enable row level security;

drop policy if exists atlas_ai_data_policies_read on public.atlas_ai_data_policies;
create policy atlas_ai_data_policies_read
on public.atlas_ai_data_policies
for select to authenticated
using (public.has_identity_permission(org_id, 'security.read'));

drop policy if exists atlas_ai_data_policies_insert on public.atlas_ai_data_policies;
create policy atlas_ai_data_policies_insert
on public.atlas_ai_data_policies
for insert to authenticated
with check (
  public.has_identity_permission(org_id, 'security.manage')
  and audit_logging_enabled = true
);

drop policy if exists atlas_ai_data_policies_update on public.atlas_ai_data_policies;
create policy atlas_ai_data_policies_update
on public.atlas_ai_data_policies
for update to authenticated
using (public.has_identity_permission(org_id, 'security.manage'))
with check (
  public.has_identity_permission(org_id, 'security.manage')
  and audit_logging_enabled = true
);

drop policy if exists atlas_ai_data_policy_audit_read on public.atlas_ai_data_policy_audit;
create policy atlas_ai_data_policy_audit_read
on public.atlas_ai_data_policy_audit
for select to authenticated
using (
  public.has_identity_permission(org_id, 'security.read')
  or public.has_identity_permission(org_id, 'audit.read')
);

revoke all on public.atlas_ai_data_policies from anon, authenticated;
revoke all on public.atlas_ai_data_policy_audit from anon, authenticated;
revoke all on function public.atlas_ai_data_policy_before_write() from public;
revoke all on function public.atlas_ai_data_policy_record_audit() from public;

grant select, insert, update on public.atlas_ai_data_policies to authenticated;
grant select on public.atlas_ai_data_policy_audit to authenticated;
grant all on public.atlas_ai_data_policies, public.atlas_ai_data_policy_audit to service_role;
