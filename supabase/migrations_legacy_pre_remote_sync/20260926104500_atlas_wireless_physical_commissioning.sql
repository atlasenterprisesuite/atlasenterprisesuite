-- ATLAS Wireless physical commissioning control.
-- Commissioning records track external, physical evidence; they do not create RF authority or hardware.

insert into public.identity_permissions (code, description)
values
  ('wireless.network.commissioning.read', 'Read ATLAS Wireless physical commissioning runs and evidence.'),
  ('wireless.network.commissioning.write', 'Record ATLAS Wireless physical commissioning evidence and task results.'),
  ('wireless.network.commissioning.approve', 'Approve a fully evidenced ATLAS Wireless physical commissioning run.')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
values
  ('owner', 'wireless.network.commissioning.read'),
  ('owner', 'wireless.network.commissioning.write'),
  ('owner', 'wireless.network.commissioning.approve'),
  ('admin', 'wireless.network.commissioning.read'),
  ('admin', 'wireless.network.commissioning.write'),
  ('admin', 'wireless.network.commissioning.approve')
on conflict do nothing;

create table if not exists public.wireless_commissioning_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  site_code text not null,
  display_name text not null,
  state text not null default 'planned'
    check (state in ('planned','evidence_collection','validation','ready_for_approval','commissioned','rejected')),
  target_mode text not null default 'atlas-owned'
    check (target_mode in ('atlas-owned','hybrid')),
  approved_by uuid,
  approved_at timestamptz,
  approval_evidence_refs jsonb not null default '[]'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, site_code),
  check (jsonb_typeof(approval_evidence_refs) = 'array'),
  check (
    state <> 'commissioned' or
    (approved_by is not null and approved_at is not null and jsonb_array_length(approval_evidence_refs) > 0)
  )
);

create table if not exists public.wireless_commissioning_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.wireless_commissioning_runs(id) on delete cascade,
  task_code text not null
    check (task_code in (
      'physical_site',
      'radio_commissioned',
      'spectrum_authorized',
      'sas_coordinated',
      'core_reachable',
      'backhaul_operational',
      'subscriber_identity_ready',
      'device_attach',
      'data_path',
      'observability',
      'emergency_boundary',
      'rf_safety'
    )),
  state text not null default 'pending'
    check (state in ('pending','passed','failed','not_applicable')),
  evidence_refs jsonb not null default '[]'::jsonb,
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  unique (run_id, task_code),
  check (jsonb_typeof(evidence_refs) = 'array'),
  check (
    state not in ('passed','not_applicable') or
    (verified_by is not null and verified_at is not null and jsonb_array_length(evidence_refs) > 0)
  )
);

alter table public.wireless_commissioning_runs enable row level security;
alter table public.wireless_commissioning_tasks enable row level security;

drop policy if exists wireless_commissioning_runs_read on public.wireless_commissioning_runs;
create policy wireless_commissioning_runs_read
on public.wireless_commissioning_runs
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = wireless_commissioning_runs.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists wireless_commissioning_tasks_read on public.wireless_commissioning_tasks;
create policy wireless_commissioning_tasks_read
on public.wireless_commissioning_tasks
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = wireless_commissioning_tasks.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

revoke insert, update, delete on public.wireless_commissioning_runs from authenticated;
revoke insert, update, delete on public.wireless_commissioning_tasks from authenticated;
grant select on public.wireless_commissioning_runs to authenticated;
grant select on public.wireless_commissioning_tasks to authenticated;
