create table if not exists public.audit_ledger_events (
  event_id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  tenant_id text not null check (length(trim(tenant_id)) > 0),
  workflow_id uuid not null references public.execution_workflows(id) on delete restrict,
  task_id uuid not null references public.execution_tasks(id) on delete restrict,
  actor_id uuid not null,
  action_type text not null check (
    action_type in (
      'TASK_STARTED',
      'GATE_EVALUATED',
      'EVIDENCE_RECORDED',
      'TASK_FAILED',
      'TASK_COMPLETED',
      'WORKFLOW_BLOCKED'
    )
    or action_type ~ '^execution\.[a-z0-9_.-]{1,100}$'
  ),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  previous_state_hash text not null check (
    previous_state_hash = 'GENESIS_BLOCK' or previous_state_hash ~ '^[a-f0-9]{64}$'
  ),
  metadata jsonb not null default '{}'::jsonb,
  nonce uuid not null,
  digest_version integer not null check (digest_version = 1),
  created_at timestamptz not null,
  check (jsonb_typeof(metadata) = 'object'),
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
  and exists (
    select 1
    from public.execution_workflows w
    where w.id = audit_ledger_events.workflow_id
      and w.org_id = audit_ledger_events.org_id
      and w.tenant_id = audit_ledger_events.tenant_id
  )
  and exists (
    select 1
    from public.execution_tasks t
    where t.id = audit_ledger_events.task_id
      and t.workflow_id = audit_ledger_events.workflow_id
      and t.org_id = audit_ledger_events.org_id
      and t.tenant_id = audit_ledger_events.tenant_id
  )
);

revoke all on public.audit_ledger_events from authenticated;
grant select on public.audit_ledger_events to authenticated;

comment on table public.audit_ledger_events is
  'ATLAS cryptographic audit ledger. Rows are immutable and contain only bounded non-secret event metadata.';

create or replace function public.append_audit_ledger_event(
  p_event_id uuid,
  p_org_id uuid,
  p_tenant_id text,
  p_workflow_id uuid,
  p_task_id uuid,
  p_actor_id uuid,
  p_action_type text,
  p_payload_digest text,
  p_previous_state_hash text,
  p_metadata jsonb,
  p_nonce uuid,
  p_digest_version integer,
  p_created_at timestamptz
)
returns public.audit_ledger_events
language plpgsql
set search_path = public
as $$
declare
  v_head public.audit_ledger_events%rowtype;
  v_inserted public.audit_ledger_events%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || p_workflow_id::text, 0)
  );

  if not (
    p_action_type in (
      'TASK_STARTED',
      'GATE_EVALUATED',
      'EVIDENCE_RECORDED',
      'TASK_FAILED',
      'TASK_COMPLETED',
      'WORKFLOW_BLOCKED'
    )
    or p_action_type ~ '^execution\.[a-z0-9_.-]{1,100}$'
  ) then
    raise exception 'audit_ledger_invalid_action_type';
  end if;

  if not exists (
    select 1
    from public.execution_workflows w
    where w.id = p_workflow_id
      and w.org_id = p_org_id
      and w.tenant_id = p_tenant_id
  ) then
    raise exception 'audit_ledger_invalid_scope';
  end if;

  if not exists (
    select 1
    from public.execution_tasks t
    where t.id = p_task_id
      and t.workflow_id = p_workflow_id
      and t.org_id = p_org_id
      and t.tenant_id = p_tenant_id
  ) then
    raise exception 'audit_ledger_invalid_scope';
  end if;

  select *
  into v_head
  from public.audit_ledger_events
  where org_id = p_org_id
    and workflow_id = p_workflow_id
  order by created_at desc, event_id desc
  limit 1;

  if p_previous_state_hash <> coalesce(v_head.payload_digest, 'GENESIS_BLOCK') then
    raise exception 'audit_ledger_stale_head';
  end if;

  if v_head.event_id is not null and p_created_at <= v_head.created_at then
    raise exception 'audit_ledger_stale_head';
  end if;

  insert into public.audit_ledger_events (
    event_id,
    org_id,
    tenant_id,
    workflow_id,
    task_id,
    actor_id,
    action_type,
    payload_digest,
    previous_state_hash,
    metadata,
    nonce,
    digest_version,
    created_at
  ) values (
    p_event_id,
    p_org_id,
    p_tenant_id,
    p_workflow_id,
    p_task_id,
    p_actor_id,
    p_action_type,
    p_payload_digest,
    p_previous_state_hash,
    p_metadata,
    p_nonce,
    p_digest_version,
    p_created_at
  )
  returning * into v_inserted;

  return v_inserted;
end;
$$;

revoke all on function public.append_audit_ledger_event(
  uuid, uuid, text, uuid, uuid, uuid, text, text, text, jsonb, uuid, integer, timestamptz
) from public;
revoke all on function public.append_audit_ledger_event(
  uuid, uuid, text, uuid, uuid, uuid, text, text, text, jsonb, uuid, integer, timestamptz
) from authenticated;
grant execute on function public.append_audit_ledger_event(
  uuid, uuid, text, uuid, uuid, uuid, text, text, text, jsonb, uuid, integer, timestamptz
) to service_role;
