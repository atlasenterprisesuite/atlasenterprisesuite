\set ON_ERROR_STOP on
-- Executed exclusively on disposable PostgreSQL 17 with synthetic fixtures.
do $$
begin
 if has_table_privilege('anon','public.atlas_enterprise_credit_accounts','SELECT') or
    has_table_privilege('authenticated','public.atlas_enterprise_credit_accounts','SELECT') or
    has_table_privilege('authenticated','public.atlas_enterprise_credit_reservations','INSERT') or
    has_function_privilege('authenticated',
     'public.atlas_enterprise_credit_reserve(uuid,uuid,text,text,uuid,bigint)','EXECUTE') then
   raise exception 'P0 direct user grants present';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.atlas_enterprise_credit_accounts'::regclass) or
    not (select relrowsecurity from pg_class where oid='public.atlas_enterprise_credit_events'::regclass) then
   raise exception 'P0 RLS absent';
 end if;
end;
$$;

set role service_role;
do $$
declare
 a constant uuid := '00000000-0000-4000-8000-000000000001';
 b constant uuid := '00000000-0000-4000-8000-000000000002';
 u constant uuid := '00000000-0000-4000-8000-000000000101';
 owner_id constant uuid := '00000000-0000-4000-8000-000000000102';
 t constant uuid := '00000000-0000-4000-8000-000000000301';
 e constant uuid := '00000000-0000-4000-8000-000000000401';
 false_e constant uuid := '00000000-0000-4000-8000-000000000402';
 r uuid;
 r2 uuid;
 account public.atlas_enterprise_credit_accounts%rowtype;
 events integer;
begin
 perform public.atlas_enterprise_credit_set_limit(a,u,'2026-11',10,true,owner_id);
 select public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-unit-001',t,4) into r;
 select public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-unit-001',t,4) into r2;
 if r <> r2 then raise exception 'P0 duplicate request generated different reservation'; end if;
 select * into account from public.atlas_enterprise_credit_accounts
   where org_id=a and user_id=u and window_id='2026-11';
 if account.reserved_credits<>4 or account.spent_credits<>0 then
   raise exception 'P0 idempotent reserve balance wrong';
 end if;

 begin
   perform public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-unit-001',t,5);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 begin
   perform public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-unit-002',t,7);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 begin
   perform public.atlas_enterprise_credit_reserve(b,u,'2026-11','request-key-unit-003',t,1);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 begin
   perform public.atlas_enterprise_credit_settle(r,3,false_e,u);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;

 perform public.atlas_enterprise_credit_settle(r,3,e,u);
 perform public.atlas_enterprise_credit_settle(r,3,e,u);
 select * into account from public.atlas_enterprise_credit_accounts
   where org_id=a and user_id=u and window_id='2026-11';
 if account.reserved_credits<>0 or account.spent_credits<>3 then
   raise exception 'P0 settlement balance or partial refund wrong';
 end if;
 begin
   perform public.atlas_enterprise_credit_settle(r,4,e,u);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 begin
   perform public.atlas_enterprise_credit_release(r,u);
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;

 select public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-unit-004',t,2) into r2;
 perform public.atlas_enterprise_credit_release(r2,u);
 perform public.atlas_enterprise_credit_release(r2,u);
 select * into account from public.atlas_enterprise_credit_accounts
   where org_id=a and user_id=u and window_id='2026-11';
 if account.reserved_credits<>0 or account.spent_credits<>3 then
   raise exception 'P0 cancellation balance wrong';
 end if;
 select count(*) into events from public.atlas_enterprise_credit_events
    where org_id=a and user_id=u and window_id='2026-11';
 if events<>5 then
    raise exception 'P0 immutable audit count mismatch: %', events;
 end if;
 begin
   perform public.atlas_enterprise_credit_set_limit(a,u,'2026-11',10,true,
     '00000000-0000-4000-8000-000000000201');
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 begin
   perform public.atlas_enterprise_credit_settle(r,3,e,
     '00000000-0000-4000-8000-000000000201');
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 -- Deliberately leave a reservation pending to verify release AFTER revocation.
 perform public.atlas_enterprise_credit_reserve(a,u,'2026-11','request-key-pending-006',t,1);
 raise notice 'enterprise-credit-ledger unit invariants PASS';
end;
$$;
reset role;

update public.organization_members set status='revoked'
 where org_id='00000000-0000-4000-8000-000000000001'
   and user_id='00000000-0000-4000-8000-000000000101';
set role service_role;
do $
declare pending uuid; operator uuid := '00000000-0000-4000-8000-000000000102';
begin
 begin
  perform public.atlas_enterprise_credit_reserve(
   '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000101',
   '2026-11','request-key-revoked-001',
   '00000000-0000-4000-8000-000000000301',1);
  raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 select id into pending from public.atlas_enterprise_credit_reservations
   where request_key='request-key-pending-006';
 if pending is null then raise exception 'pending reservation missing'; end if;
 begin
   perform public.atlas_enterprise_credit_release(pending,
      '00000000-0000-4000-8000-000000000201');
   raise exception 'missing_failure';
 exception when others then if sqlerrm='missing_failure' then raise; end if;
 end;
 perform public.atlas_enterprise_credit_release(pending,operator);
 perform public.atlas_enterprise_credit_release(pending,operator);
 if not exists (
   select 1 from public.atlas_enterprise_credit_events where reservation_id=pending
   and operation='released' and actor_user_id=operator
 ) then raise exception 'revoke cleanup actual operator not audited'; end if;
 if (select reserved_credits from public.atlas_enterprise_credit_accounts
   where org_id='00000000-0000-4000-8000-000000000001'
   and user_id='00000000-0000-4000-8000-000000000101'
   and window_id='2026-11') <> 0 then
   raise exception 'revocation cleanup balance P0';
 end if;
end;
$;
reset role;
select 'enterprise-credit-ledger-pg17-pass' as verdict;
