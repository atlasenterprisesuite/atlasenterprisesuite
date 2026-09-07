-- ATLAS Supabase v2 identity + accounting isolation E2E
-- Run only from a trusted database test runner with privileges to SET ROLE authenticated.
-- The entire scenario is rolled back and must leave no persistent test data.

begin;

create temp table e2e_ctx (
  user1 uuid not null,
  user2 uuid not null,
  tenant1 uuid,
  org1 uuid,
  tenant2 uuid,
  org2 uuid,
  cash1 uuid,
  revenue1 uuid,
  foreign_account uuid,
  journal1 uuid,
  journal_cross uuid,
  user1_context_ok boolean not null default false,
  user2_context_ok boolean not null default false,
  user1_cross_tenant_read_hidden boolean not null default false,
  user1_posted_balanced boolean not null default false,
  cross_tenant_reference_rejected boolean not null default false
) on commit drop;

insert into e2e_ctx(user1, user2)
values (gen_random_uuid(), gen_random_uuid());

insert into auth.users(id, aud, role, created_at, updated_at)
select user1, 'authenticated', 'authenticated', now(), now() from e2e_ctx
union all
select user2, 'authenticated', 'authenticated', now(), now() from e2e_ctx;

with input as (
  select
    user1,
    'ATLAS E2E Tenant One'::text as tenant_name,
    ('e2e-t1-' || left(replace(user1::text, '-', ''), 12))::text as tenant_slug,
    'ATLAS E2E Org One'::text as org_name,
    ('e2e-o1-' || left(replace(user1::text, '-', ''), 12))::text as org_slug
  from e2e_ctx
), b as (
  select bootstrap.tenant_id, bootstrap.organization_id
  from input
  cross join lateral public.bootstrap_atlas_tenant_service(
    input.user1, input.tenant_name, input.tenant_slug, input.org_name, input.org_slug
  ) bootstrap
)
update e2e_ctx set tenant1=b.tenant_id, org1=b.organization_id from b;

with input as (
  select
    user2,
    'ATLAS E2E Tenant Two'::text as tenant_name,
    ('e2e-t2-' || left(replace(user2::text, '-', ''), 12))::text as tenant_slug,
    'ATLAS E2E Org Two'::text as org_name,
    ('e2e-o2-' || left(replace(user2::text, '-', ''), 12))::text as org_slug
  from e2e_ctx
), b as (
  select bootstrap.tenant_id, bootstrap.organization_id
  from input
  cross join lateral public.bootstrap_atlas_tenant_service(
    input.user2, input.tenant_name, input.tenant_slug, input.org_name, input.org_slug
  ) bootstrap
)
update e2e_ctx set tenant2=b.tenant_id, org2=b.organization_id from b;

grant all on table e2e_ctx to authenticated;
set local role authenticated;

-- User 1 resolves only its own active tenant/org context.
select set_config('request.jwt.claim.sub', (select user1::text from e2e_ctx), true);
update e2e_ctx c
set user1_context_ok = (
  select count(*) = 1
     and coalesce(bool_and(x.tenant_id = c.tenant1 and x.organization_id = c.org1), false)
  from public.atlas_identity_context() x
);

-- User 1 can execute governed accounting writes inside its own scope.
update e2e_ctx c
set cash1 = public.create_accounting_account(c.tenant1, c.org1, '1000', 'E2E Cash', 'asset', 'debit', false),
    revenue1 = public.create_accounting_account(c.tenant1, c.org1, '4000', 'E2E Revenue', 'revenue', 'credit', false);

update e2e_ctx c
set journal1 = public.create_accounting_journal_draft(
  c.tenant1, c.org1, 'E2E-POST-1', current_date, 'Balanced E2E journal', 'e2e', null
);

select public.replace_accounting_journal_lines(
  c.tenant1,
  c.org1,
  c.journal1,
  jsonb_build_array(
    jsonb_build_object('account_id', c.cash1, 'debit', 100, 'credit', 0, 'description', 'E2E debit'),
    jsonb_build_object('account_id', c.revenue1, 'debit', 0, 'credit', 100, 'description', 'E2E credit')
  )
)
from e2e_ctx c;

select public.post_accounting_journal(c.tenant1, c.org1, c.journal1)
from e2e_ctx c;

update e2e_ctx c
set user1_posted_balanced = exists (
  select 1
  from public.journal_entries j
  join public.journal_lines l
    on l.journal_entry_id=j.id and l.tenant_id=j.tenant_id and l.org_id=j.org_id
  where j.id=c.journal1
    and j.tenant_id=c.tenant1
    and j.org_id=c.org1
    and j.status='posted'
  group by j.id
  having sum(l.debit)=100 and sum(l.credit)=100 and sum(l.debit)=sum(l.credit)
);

-- User 2 gets a separate scope and creates one account there.
select set_config('request.jwt.claim.sub', (select user2::text from e2e_ctx), true);
update e2e_ctx c
set user2_context_ok = (
  select count(*) = 1
     and coalesce(bool_and(x.tenant_id = c.tenant2 and x.organization_id = c.org2), false)
  from public.atlas_identity_context() x
);

update e2e_ctx c
set foreign_account = public.create_accounting_account(
  c.tenant2, c.org2, '2000', 'E2E Foreign Asset', 'asset', 'debit', false
);

-- User 1 cannot see tenant 2 through RLS.
select set_config('request.jwt.claim.sub', (select user1::text from e2e_ctx), true);
update e2e_ctx c
set user1_cross_tenant_read_hidden = not exists (
  select 1
  from public.chart_of_accounts a
  where a.tenant_id=c.tenant2 and a.org_id=c.org2
);

-- A tenant 2 account cannot be smuggled into a tenant 1 journal.
update e2e_ctx c
set journal_cross = public.create_accounting_journal_draft(
  c.tenant1, c.org1, 'E2E-CROSS-1', current_date, 'Cross-scope rejection test', 'e2e', null
);

do $$
declare
  v e2e_ctx%rowtype;
begin
  select * into v from e2e_ctx;
  begin
    perform public.replace_accounting_journal_lines(
      v.tenant1,
      v.org1,
      v.journal_cross,
      jsonb_build_array(
        jsonb_build_object('account_id', v.cash1, 'debit', 50, 'credit', 0),
        jsonb_build_object('account_id', v.foreign_account, 'debit', 0, 'credit', 50)
      )
    );
    raise exception 'ATLAS_E2E_CROSS_SCOPE_NOT_REJECTED';
  exception
    when others then
      if sqlerrm = 'ATLAS_E2E_CROSS_SCOPE_NOT_REJECTED' then
        raise;
      end if;
      update e2e_ctx set cross_tenant_reference_rejected = true;
  end;
end $$;

-- Hard fail if any required invariant did not hold.
do $$
declare
  v e2e_ctx%rowtype;
begin
  select * into v from e2e_ctx;
  if not (
    v.user1_context_ok
    and v.user2_context_ok
    and v.user1_cross_tenant_read_hidden
    and v.user1_posted_balanced
    and v.cross_tenant_reference_rejected
  ) then
    raise exception 'ATLAS E2E invariant failure: %', row_to_json(v);
  end if;
end $$;

select
  user1_context_ok,
  user2_context_ok,
  user1_cross_tenant_read_hidden,
  user1_posted_balanced,
  cross_tenant_reference_rejected
from e2e_ctx;

reset role;
rollback;
