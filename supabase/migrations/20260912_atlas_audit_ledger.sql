create table if not exists public.audit_ledger_events (
  event_id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_id uuid not null references public.execution_workflows(id) on delete restrict,
  task_id uuid not null references public.execution_tasks(id) on delete restrict,
  actor_id uuid not null,
  action_type text not null check (length(trim(action_type)) > 0),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  previous_state_hash text not null check (
    previous_state_hash = 'GENESIS_BLOCK' or previous_state_hash ~ '^[a-f0-9]{64}$'
  ),
  metadata jsonb not null default '{}'::jsonb,
  nonce uuid not null,
  digest_version integer not null check (digest_version = 1),
  created_at timestamptz not null,
  check (octet_length(metadata::text) <= 16384)
);

create index if not exists audit_ledger_org_workflow_created_idx
  on public.audit_ledger_events (org_id, workflow_id, created_at, event_id);
create index if not exists audit_ledger_org_created_idx
  on public.audit_ledger_events (org_id, created_at);

create or replace function public.enforce_audit_ledger_immutability()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_ledger_immutable';
end;
$$;

drop trigger if exists trg_audit_ledger_immutable on public.audit_ledger_events;
create trigger trg_audit_ledger_immutable
  before update or delete on public.audit_ledger_events
  for each row execute function public.enforce_audit_ledger_immutability();

alter table public.audit_ledger_events enable row level security;

drop policy if exists audit_ledger_member_read on public.audit_ledger_events;
create policy audit_ledger_member_read on public.audit_ledger_events
for select to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.org_id = audit_ledger_events.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
  )
);

revoke all on public.audit_ledger_events from authenticated;
grant select on public.audit_ledger_events to authenticated;

comment on table public.audit_ledger_events is
  'ATLAS cryptographic audit ledger. Rows are immutable and contain only bounded non-secret event metadata.';
