-- ATLAS 777 engine-only smoke. NOT a certification of ATLAS production RPCs.
\set ON_ERROR_STOP on
begin;
create schema atlas_777_fixture;
create table atlas_777_fixture.tenant_rows (
  org text not null,
  id integer generated always as identity primary key,
  value text not null
);
alter table atlas_777_fixture.tenant_rows enable row level security;
create role atlas_777_fixture_user nologin;
grant usage on schema atlas_777_fixture to atlas_777_fixture_user;
grant select, insert, update on atlas_777_fixture.tenant_rows to atlas_777_fixture_user;
create policy tenant_isolation on atlas_777_fixture.tenant_rows
  for all to atlas_777_fixture_user
  using (org = current_setting('atlas_777.org', true))
  with check (org = current_setting('atlas_777.org', true));
insert into atlas_777_fixture.tenant_rows(org,value) values ('A','alpha'),('B','beta');
set local role atlas_777_fixture_user;
select set_config('atlas_777.org','A',true);
do $$
begin
  if (select count(*) from atlas_777_fixture.tenant_rows) <> 1 then
    raise exception 'TENANT_A_VISIBILITY_FAILED';
  end if;
  begin
    insert into atlas_777_fixture.tenant_rows(org,value) values ('B','cross-tenant');
    raise exception 'CROSS_TENANT_WRITE_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select current_setting('transaction_isolation') as isolation;
