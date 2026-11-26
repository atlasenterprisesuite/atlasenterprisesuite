-- ATLAS Enterprise Credit Ledger 777 — candidate schema (not applied to production).
-- Install through a reviewed/generated Supabase migration after isolated PostgreSQL 17
-- tests, verified RLS/grants and the canonical exact-SHA release process.
-- Credits are internal usage units, NOT cash, payments or provider authorization.
-- No user-facing Data API access. The authenticated atlas-execution Edge server
-- is the only approved caller. Every mutating operation is atomic.
create table if not exists public.atlas_enterprise_credit_accounts (
  org_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  window_id text not null check (window_id ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  limit_credits bigint not null default 0 check (limit_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  spent_credits bigint not null default 0 check (spent_credits >= 0),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id, window_id),
  constraint atlas_enterprise_account_balance_check
    check (limit_credits >= reserved_credits and limit_credits - reserved_credits >= spent_credits)
);

create table if not exists public.atlas_enterprise_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  window_id text not null,
  request_key text not null check (length(request_key) between 12 and 160),
  task_id uuid not null references public.execution_tasks(id) on delete restrict,
  requested_credits bigint not null check (requested_credits > 0),
  settled_credits bigint not null default 0 check (settled_credits >= 0),
  status text not null default 'reserved' check (status in ('reserved','settled','released')),
  evidence_id uuid references public.execution_evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (org_id, user_id, window_id)
    references public.atlas_enterprise_credit_accounts(org_id, user_id, window_id) on delete restrict,
  unique (org_id, user_id, window_id, request_key),
  constraint atlas_enterprise_reservation_amount_check check (settled_credits <= requested_credits),
  constraint atlas_enterprise_reservation_resolution_check check (
    (status = 'reserved' and settled_credits = 0 and evidence_id is null and resolved_at is null)
    or (status = 'released' and settled_credits = 0 and evidence_id is null and resolved_at is not null)
    or (status = 'settled' and evidence_id is not null and resolved_at is not null)
  )
);
create index if not exists atlas_enterprise_reservations_open_idx
  on public.atlas_enterprise_credit_reservations(org_id, status, created_at)
  where status = 'reserved';

create table if not exists public.atlas_enterprise_credit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  window_id text not null,
  reservation_id uuid references public.atlas_enterprise_credit_reservations(id) on delete restrict,
  operation text not null check (operation in ('limit_set','reserved','settled','released')),
  amount_credits bigint not null check (amount_credits >= 0),
  actor_user_id uuid not null,
  request_key text,
  created_at timestamptz not null default now(),
  foreign key (org_id, user_id, window_id)
    references public.atlas_enterprise_credit_accounts(org_id, user_id, window_id) on delete restrict
);
create index if not exists atlas_enterprise_credit_events_scope_idx
  on public.atlas_enterprise_credit_events(org_id, user_id, window_id, created_at desc);

-- Defense in depth even if an exposed schema inherits default grants.
alter table public.atlas_enterprise_credit_accounts enable row level security;
alter table public.atlas_enterprise_credit_reservations enable row level security;
alter table public.atlas_enterprise_credit_events enable row level security;
revoke all on table public.atlas_enterprise_credit_accounts from PUBLIC, anon, authenticated;
revoke all on table public.atlas_enterprise_credit_reservations from PUBLIC, anon, authenticated;
revoke all on table public.atlas_enterprise_credit_events from PUBLIC, anon, authenticated;
grant select, insert, update on public.atlas_enterprise_credit_accounts to service_role;
grant select, insert, update on public.atlas_enterprise_credit_reservations to service_role;
grant select, insert on public.atlas_enterprise_credit_events to service_role;

-- Write-once audit records. No updates/deletes to immutable events.
create or replace function public.atlas_enterprise_credit_event_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'enterprise_credit_event_immutable' using errcode = 'P0001';
end;
$$;
revoke all on function public.atlas_enterprise_credit_event_immutable() from PUBLIC, anon, authenticated;
drop trigger if exists atlas_enterprise_credit_events_immutable on public.atlas_enterprise_credit_events;
create trigger atlas_enterprise_credit_events_immutable
  before update or delete on public.atlas_enterprise_credit_events
  for each row execute function public.atlas_enterprise_credit_event_immutable();

-- Operator allocation is disabled by default. Must be an active organization
-- owner/admin and target must have active organization membership. Decreases
-- cannot invalidate outstanding reservations or settled consumption.
create or replace function public.atlas_enterprise_credit_set_limit(
  p_org_id uuid, p_user_id uuid, p_window_id text, p_limit bigint,
  p_enabled boolean, p_operator_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_org_id is null or p_user_id is null or p_operator_id is null
     or p_window_id is null or p_window_id !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_limit is null or p_limit < 0 or p_enabled is null then
    raise exception 'enterprise_credit_invalid_allocation' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.organization_members
     where org_id=p_org_id and user_id=p_operator_id
       and status='active' and role in ('owner','admin','platform_admin')
  ) or not exists (
    select 1 from public.organization_members
     where org_id=p_org_id and user_id=p_user_id and status='active'
  ) then
    raise exception 'enterprise_credit_membership_denied' using errcode='P0001';
  end if;

  insert into public.atlas_enterprise_credit_accounts
    (org_id, user_id, window_id, limit_credits, enabled)
  values (p_org_id, p_user_id, p_window_id, p_limit, p_enabled)
  on conflict (org_id, user_id, window_id)
  do update set limit_credits=excluded.limit_credits,
                enabled=excluded.enabled, updated_at=now();
  -- If the new allocation is smaller than spent + reserved, the check
  -- constraint fails and the entire transaction rolls back.
  insert into public.atlas_enterprise_credit_events
    (org_id, user_id, window_id, operation, amount_credits, actor_user_id)
  values (p_org_id, p_user_id, p_window_id, 'limit_set', p_limit, p_operator_id);
end;
$$;

-- Account row lock SERIALIZES all reservations for a user and month, including
-- identical request keys issued concurrently from separate runtimes.
create or replace function public.atlas_enterprise_credit_reserve(
  p_org_id uuid, p_user_id uuid, p_window_id text,
  p_request_key text, p_task_id uuid, p_credits bigint
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  a public.atlas_enterprise_credit_accounts%rowtype;
  prior public.atlas_enterprise_credit_reservations%rowtype;
  v_id uuid;
begin
  if p_org_id is null or p_user_id is null or p_task_id is null
     or p_window_id is null or p_window_id !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_request_key is null or length(p_request_key) not between 12 and 160
     or p_credits is null or p_credits <= 0 then
    raise exception 'enterprise_credit_invalid_reservation' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.organization_members where org_id=p_org_id
      and user_id=p_user_id and status='active'
  ) or not exists (
    select 1 from public.execution_tasks where id=p_task_id
      and org_id=p_org_id and owner_user_id=p_user_id
  ) then
    raise exception 'enterprise_credit_scope_denied' using errcode='P0001';
  end if;

  select * into a from public.atlas_enterprise_credit_accounts
  where org_id=p_org_id and user_id=p_user_id and window_id=p_window_id
  for update;
  if not found or a.enabled is not true then
    raise exception 'enterprise_credit_allocation_unavailable' using errcode='P0001';
  end if;

  select * into prior from public.atlas_enterprise_credit_reservations
  where org_id=p_org_id and user_id=p_user_id and window_id=p_window_id
    and request_key=p_request_key;
  if found then
    if prior.requested_credits<>p_credits or prior.task_id<>p_task_id then
      raise exception 'enterprise_credit_idempotency_conflict' using errcode='P0001';
    end if;
    return prior.id;
  end if;
  if a.limit_credits - a.reserved_credits - a.spent_credits < p_credits then
    raise exception 'enterprise_credit_limit_exceeded' using errcode='P0001';
  end if;

  update public.atlas_enterprise_credit_accounts
     set reserved_credits=reserved_credits+p_credits, updated_at=now()
   where org_id=p_org_id and user_id=p_user_id and window_id=p_window_id;
  insert into public.atlas_enterprise_credit_reservations
    (org_id,user_id,window_id,request_key,task_id,requested_credits)
  values (p_org_id,p_user_id,p_window_id,p_request_key,p_task_id,p_credits)
  returning id into v_id;
  insert into public.atlas_enterprise_credit_events
    (org_id,user_id,window_id,reservation_id,operation,amount_credits,actor_user_id,request_key)
  values (p_org_id,p_user_id,p_window_id,v_id,'reserved',p_credits,p_user_id,p_request_key);
  return v_id;
end;
$$;

-- Settlement requires verified authoritative evidence linked to that exact
-- execution task and organization. Partial settlement refunds the remainder.
create or replace function public.atlas_enterprise_credit_settle(
  p_reservation_id uuid, p_charged bigint, p_evidence_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  snapshot public.atlas_enterprise_credit_reservations%rowtype;
  r public.atlas_enterprise_credit_reservations%rowtype;
begin
  if p_reservation_id is null or p_evidence_id is null or p_charged is null or p_charged < 0 then
    raise exception 'enterprise_credit_invalid_settlement' using errcode='P0001';
  end if;
  select * into snapshot from public.atlas_enterprise_credit_reservations
  where id=p_reservation_id;
  if not found then raise exception 'enterprise_credit_reservation_missing' using errcode='P0001'; end if;

  -- Keep lock order consistent with reserve: account first, reservation second.
  perform 1 from public.atlas_enterprise_credit_accounts
  where org_id=snapshot.org_id and user_id=snapshot.user_id and window_id=snapshot.window_id
  for update;
  select * into r from public.atlas_enterprise_credit_reservations where id=p_reservation_id for update;
  if r.status = 'settled' then
    if r.settled_credits=p_charged and r.evidence_id=p_evidence_id then return r.id; end if;
    raise exception 'enterprise_credit_settlement_conflict' using errcode='P0001';
  end if;
  if r.status<>'reserved' or p_charged > r.requested_credits then
    raise exception 'enterprise_credit_invalid_settlement_state' using errcode='P0001';
  end if;
  if not exists (
    select 1 from public.organization_members where org_id=r.org_id and user_id=r.user_id and status='active'
  ) or not exists (
    select 1 from public.execution_evidence where id=p_evidence_id
      and org_id=r.org_id and task_id=r.task_id and verified=true
  ) then
    raise exception 'enterprise_credit_evidence_or_membership_missing' using errcode='P0001';
  end if;

  update public.atlas_enterprise_credit_accounts
     set reserved_credits=reserved_credits-r.requested_credits,
         spent_credits=spent_credits+p_charged, updated_at=now()
   where org_id=r.org_id and user_id=r.user_id and window_id=r.window_id;
  update public.atlas_enterprise_credit_reservations
     set status='settled', settled_credits=p_charged, evidence_id=p_evidence_id, resolved_at=now()
   where id=r.id;
  insert into public.atlas_enterprise_credit_events
    (org_id,user_id,window_id,reservation_id,operation,amount_credits,actor_user_id,request_key)
  values (r.org_id,r.user_id,r.window_id,r.id,'settled',p_charged,r.user_id,r.request_key);
  return r.id;
end;
$$;

-- Cancellation is permitted even after membership revocation so that suspended
-- users cannot indefinitely consume allocations. Only trusted service_role
-- callers can perform it, and the release is journaled in the same transaction.
create or replace function public.atlas_enterprise_credit_release(
  p_reservation_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  snapshot public.atlas_enterprise_credit_reservations%rowtype;
  r public.atlas_enterprise_credit_reservations%rowtype;
begin
  if p_reservation_id is null then
    raise exception 'enterprise_credit_invalid_release' using errcode='P0001';
  end if;
  select * into snapshot from public.atlas_enterprise_credit_reservations where id=p_reservation_id;
  if not found then raise exception 'enterprise_credit_reservation_missing' using errcode='P0001'; end if;
  perform 1 from public.atlas_enterprise_credit_accounts
  where org_id=snapshot.org_id and user_id=snapshot.user_id and window_id=snapshot.window_id for update;
  select * into r from public.atlas_enterprise_credit_reservations where id=p_reservation_id for update;
  if r.status='released' then return r.id; end if;
  if r.status<>'reserved' then
    raise exception 'enterprise_credit_release_conflict' using errcode='P0001';
  end if;
  update public.atlas_enterprise_credit_accounts
     set reserved_credits=reserved_credits-r.requested_credits,updated_at=now()
   where org_id=r.org_id and user_id=r.user_id and window_id=r.window_id;
  update public.atlas_enterprise_credit_reservations
     set status='released',resolved_at=now() where id=r.id;
  insert into public.atlas_enterprise_credit_events
    (org_id,user_id,window_id,reservation_id,operation,amount_credits,actor_user_id,request_key)
  values (r.org_id,r.user_id,r.window_id,r.id,'released',r.requested_credits,r.user_id,r.request_key);
  return r.id;
end;
$$;

-- Strict RPC permission boundary: callers authenticated to the Data API
-- cannot invoke these functions or write/see the ledger directly.
revoke all on function public.atlas_enterprise_credit_set_limit(uuid,uuid,text,bigint,boolean,uuid) from PUBLIC, anon, authenticated;
revoke all on function public.atlas_enterprise_credit_reserve(uuid,uuid,text,text,uuid,bigint) from PUBLIC, anon, authenticated;
revoke all on function public.atlas_enterprise_credit_settle(uuid,bigint,uuid) from PUBLIC, anon, authenticated;
revoke all on function public.atlas_enterprise_credit_release(uuid) from PUBLIC, anon, authenticated;
grant execute on function public.atlas_enterprise_credit_set_limit(uuid,uuid,text,bigint,boolean,uuid) to service_role;
grant execute on function public.atlas_enterprise_credit_reserve(uuid,uuid,text,text,uuid,bigint) to service_role;
grant execute on function public.atlas_enterprise_credit_settle(uuid,bigint,uuid) to service_role;
grant execute on function public.atlas_enterprise_credit_release(uuid) to service_role;
