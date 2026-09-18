create table public.atlas_night_queue (
  queue_item_id text primary key,
  task_id text not null,
  source_thread_id text,
  tenant_id uuid not null,
  org_id uuid not null,
  status text not null check (status in ('queued','leased','running','completed_autonomous','requires_attention','failed','cancelled')),
  priority integer not null default 0,
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  lease_owner text,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  checkpoint_id text,
  archive_policy text not null default 'never' check (archive_policy in ('never','eligible_on_verified_completion')),
  archive_eligible boolean not null default false,
  next_eligible_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index atlas_night_queue_scope_status_idx
  on public.atlas_night_queue (tenant_id, org_id, status, priority desc, created_at asc);
create index atlas_night_queue_next_eligible_idx
  on public.atlas_night_queue (tenant_id, org_id, next_eligible_at)
  where status = 'queued';
create index atlas_night_queue_lease_expiry_idx
  on public.atlas_night_queue (tenant_id, org_id, lease_expires_at)
  where status in ('leased','running');

create table public.atlas_night_checkpoints (
  checkpoint_id text primary key,
  queue_item_id text not null references public.atlas_night_queue(queue_item_id) on delete cascade,
  task_id text not null,
  tenant_id uuid not null,
  org_id uuid not null,
  step_key text not null,
  idempotency_key text not null unique,
  completed_operations text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  retry_count integer not null default 0 check (retry_count >= 0),
  last_successful_operation text,
  created_at timestamptz not null default now()
);

create index atlas_night_checkpoints_lookup_idx
  on public.atlas_night_checkpoints (tenant_id, org_id, queue_item_id, created_at desc);

create table public.atlas_night_sessions (
  session_id text primary key,
  tenant_id uuid not null,
  org_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  total_queued integer not null default 0 check (total_queued >= 0),
  total_examined integer not null default 0 check (total_examined >= 0),
  total_claimed integer not null default 0 check (total_claimed >= 0),
  completed_autonomous integer not null default 0 check (completed_autonomous >= 0),
  archive_eligible integer not null default 0 check (archive_eligible >= 0),
  archived_confirmed integer not null default 0 check (archived_confirmed >= 0),
  pending integer not null default 0 check (pending >= 0),
  requires_attention integer not null default 0 check (requires_attention >= 0),
  failed integer not null default 0 check (failed >= 0),
  retries integer not null default 0 check (retries >= 0),
  blocker_categories text[] not null default '{}',
  human_actions_required text[] not null default '{}',
  evidence_refs text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index atlas_night_sessions_scope_created_idx
  on public.atlas_night_sessions (tenant_id, org_id, created_at desc);

create table public.atlas_night_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  org_id uuid not null,
  queue_item_id text,
  task_id text,
  event_type text not null,
  actor_id text,
  worker_id text,
  outcome text not null check (outcome in ('success','denied','failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index atlas_night_audit_scope_created_idx
  on public.atlas_night_audit_events (tenant_id, org_id, created_at desc);
create index atlas_night_audit_queue_idx
  on public.atlas_night_audit_events (queue_item_id, created_at desc)
  where queue_item_id is not null;

alter table public.atlas_night_queue enable row level security;
alter table public.atlas_night_checkpoints enable row level security;
alter table public.atlas_night_sessions enable row level security;
alter table public.atlas_night_audit_events enable row level security;

revoke all on public.atlas_night_queue from anon, authenticated;
revoke all on public.atlas_night_checkpoints from anon, authenticated;
revoke all on public.atlas_night_sessions from anon, authenticated;
revoke all on public.atlas_night_audit_events from anon, authenticated;
grant all on public.atlas_night_queue to service_role;
grant all on public.atlas_night_checkpoints to service_role;
grant all on public.atlas_night_sessions to service_role;
grant all on public.atlas_night_audit_events to service_role;

create or replace function public.atlas_claim_night_item(
  p_tenant_id uuid,
  p_org_id uuid,
  p_worker_id text,
  p_now timestamptz,
  p_lease_until timestamptz
)
returns setof public.atlas_night_queue
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_queue_item_id text;
  v_item public.atlas_night_queue%rowtype;
begin
  select q.queue_item_id
    into v_queue_item_id
  from public.atlas_night_queue q
  where q.tenant_id = p_tenant_id
    and q.org_id = p_org_id
    and q.attempt < q.max_attempts
    and (
      (q.status = 'queued' and (q.next_eligible_at is null or q.next_eligible_at <= p_now))
      or
      (q.status in ('leased','running') and q.lease_expires_at is not null and q.lease_expires_at <= p_now)
    )
  order by q.priority desc, q.created_at asc
  for update skip locked
  limit 1;

  if v_queue_item_id is null then
    return;
  end if;

  update public.atlas_night_queue q
     set status = 'leased',
         attempt = q.attempt + 1,
         lease_owner = p_worker_id,
         lease_expires_at = p_lease_until,
         heartbeat_at = p_now,
         next_eligible_at = null,
         archive_eligible = false,
         updated_at = p_now
   where q.queue_item_id = v_queue_item_id
     and q.tenant_id = p_tenant_id
     and q.org_id = p_org_id
  returning q.* into v_item;

  insert into public.atlas_night_audit_events(
    tenant_id, org_id, queue_item_id, task_id, event_type, worker_id, outcome, details, created_at
  ) values (
    p_tenant_id, p_org_id, v_item.queue_item_id, v_item.task_id,
    'night.queue.claimed', p_worker_id, 'success',
    jsonb_build_object('attempt', v_item.attempt, 'lease_expires_at', v_item.lease_expires_at),
    p_now
  );

  return next v_item;
end;
$$;

create or replace function public.atlas_renew_night_lease(
  p_tenant_id uuid,
  p_org_id uuid,
  p_queue_item_id text,
  p_worker_id text,
  p_now timestamptz,
  p_lease_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated boolean := false;
begin
  update public.atlas_night_queue q
     set heartbeat_at = p_now,
         lease_expires_at = p_lease_until,
         updated_at = p_now
   where q.queue_item_id = p_queue_item_id
     and q.tenant_id = p_tenant_id
     and q.org_id = p_org_id
     and q.lease_owner = p_worker_id
     and q.status in ('leased','running')
     and q.lease_expires_at is not null
     and q.lease_expires_at > p_now;

  v_updated := found;

  if v_updated then
    insert into public.atlas_night_audit_events(
      tenant_id, org_id, queue_item_id, event_type, worker_id, outcome, details, created_at
    ) values (
      p_tenant_id, p_org_id, p_queue_item_id,
      'night.lease.renewed', p_worker_id, 'success',
      jsonb_build_object('lease_expires_at', p_lease_until), p_now
    );
  end if;

  return v_updated;
end;
$$;

create or replace function public.atlas_log_night_event(
  p_tenant_id uuid,
  p_org_id uuid,
  p_queue_item_id text,
  p_task_id text,
  p_event_type text,
  p_actor_id text,
  p_worker_id text,
  p_outcome text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if p_outcome not in ('success','denied','failed') then
    raise exception 'invalid night audit outcome';
  end if;

  insert into public.atlas_night_audit_events(
    tenant_id, org_id, queue_item_id, task_id, event_type, actor_id, worker_id, outcome, details
  ) values (
    p_tenant_id, p_org_id, p_queue_item_id, p_task_id, p_event_type, p_actor_id, p_worker_id, p_outcome,
    coalesce(p_details, '{}'::jsonb)
  ) returning event_id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.atlas_claim_night_item(uuid,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.atlas_renew_night_lease(uuid,uuid,text,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.atlas_log_night_event(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.atlas_claim_night_item(uuid,uuid,text,timestamptz,timestamptz) to service_role;
grant execute on function public.atlas_renew_night_lease(uuid,uuid,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.atlas_log_night_event(uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;
