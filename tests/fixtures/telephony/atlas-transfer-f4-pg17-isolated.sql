-- ATLAS 777 REVIEW F4: isolated PostgreSQL 17 bootstrap ONLY. Never deploy to atlas-core.
-- Reuses canonical organization_members and atlas_call_sessions; NO GRANTS to app roles.
create schema if not exists atlas_transfer_test;
create table atlas_transfer_test.allowed_destinations(
 organization_id uuid not null references public.organizations(id),
 destination text not null check(destination ~ '^\+[1-9][0-9]{7,14}$'),
 primary key(organization_id,destination)
);
create table atlas_transfer_test.reservations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 actor_user_id uuid not null,
 call_session_id uuid not null references public.atlas_call_sessions(id),
 live_session_id text not null check(live_session_id ~ '^live_[a-zA-Z0-9_-]+$'),
 idempotency_key text not null check(length(idempotency_key) between 1 and 128),
 destination text not null,
 state text not null default 'transfer_pending'
  check(state in('transfer_pending','transfer_unknown','transfer_confirmed','transfer_rejected')),
 issued boolean not null default false,
 attempts smallint not null default 0 check(attempts = 0),
 created_at timestamptz not null default now(),
 unique(organization_id,call_session_id,idempotency_key),
 foreign key(organization_id,destination)
  references atlas_transfer_test.allowed_destinations(organization_id,destination)
);
-- P0: prevent two concurrent transfers of the same call even with distinct idempotency keys.
-- An unknown or confirmed transfer must not be automatically reissued.
create unique index atlas_transfer_one_active_per_call_uidx
 on atlas_transfer_test.reservations (organization_id,call_session_id)
 where state in ('transfer_pending','transfer_unknown','transfer_confirmed');
create table atlas_transfer_test.transfer_events(
 id bigint generated always as identity primary key,
 reservation_id uuid not null references atlas_transfer_test.reservations(id),
 event_type text not null,
 created_at timestamptz not null default now()
);
create or replace function atlas_transfer_test.reserve(
 p_org uuid,p_actor uuid,p_call uuid,p_live text,p_key text,p_destination text)
returns text language plpgsql security invoker set search_path='' as $fn$
declare v_existing atlas_transfer_test.reservations%rowtype;
begin
 if p_org is null or p_actor is null or p_call is null or p_live is null
 or p_live !~ '^live_[a-zA-Z0-9_-]+$' or p_key is null or length(p_key) not between 1 and 128
 or p_destination is null or p_destination !~ '^\+[1-9][0-9]{7,14}$'
 then return 'invalid_request'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  p_org::text||':'||p_call::text||':'||p_key,0));
 -- Membership is checked before replay inspection: revoked actors must not read reservation state.
 perform 1 from public.organization_members om
 where om.org_id=p_org and om.user_id=p_actor and om.status='active' for share;
 if not found then return 'membership_inactive'; end if;
 select * into v_existing from atlas_transfer_test.reservations
 where organization_id=p_org and call_session_id=p_call and idempotency_key=p_key for update;
 if found then
  if v_existing.actor_user_id<>p_actor or v_existing.destination<>p_destination
   or v_existing.live_session_id<>p_live then return 'idempotency_conflict'; end if;
  return 'already_reserved_no_reissue';
 end if;
 -- Membership lock acquired before replay check; real permission authorization remains an external P0 gate.
 perform 1 from public.atlas_call_sessions s
 where s.id=p_call and s.organization_id=p_org and s.state='connected' for share;
 if not found then return 'call_inactive_or_cross_tenant'; end if;
 if not exists(select 1 from atlas_transfer_test.allowed_destinations d
   where d.organization_id=p_org and d.destination=p_destination)
 then return 'destination_denied'; end if;
 -- Serialize distinct keys for a call; index remains final defense across workers.
 if exists (select 1 from atlas_transfer_test.reservations r
 where r.organization_id=p_org and r.call_session_id=p_call
 and r.state in ('transfer_pending','transfer_unknown','transfer_confirmed'))
 then return 'call_already_has_transfer'; end if;
 with inserted as(
  insert into atlas_transfer_test.reservations(
   organization_id,actor_user_id,call_session_id,live_session_id,idempotency_key,destination)
  values(p_org,p_actor,p_call,p_live,p_key,p_destination) returning id
 )
 insert into atlas_transfer_test.transfer_events(reservation_id,event_type)
 select id,'reserved_simulation_only' from inserted;
 return 'reserved_simulation_only';
end $fn$;
revoke all on schema atlas_transfer_test from public,anon,authenticated;
revoke all on all tables in schema atlas_transfer_test from public,anon,authenticated;
revoke all on function atlas_transfer_test.reserve(uuid,uuid,uuid,text,text,text)
 from public,anon,authenticated;
-- This fixture deliberately has no issuance function and no SIP/HTTP transport.
