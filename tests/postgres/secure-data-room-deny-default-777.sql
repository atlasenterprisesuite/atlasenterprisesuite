-- ATLAS 777: run only on a disposable PostgreSQL database after loading
-- the canonical organizations bootstrap and deny-default migration.
-- Execute with psql -v ON_ERROR_STOP=1 -f this_file.sql.
-- Never execute against atlas-core production.
begin;
do $$
declare
  t text;
  has_rls boolean;
  has_force boolean;
  n integer;
begin
  foreach t in array array[
    'atlas_data_room_documents',
    'atlas_data_room_grants',
    'atlas_data_room_access_events'
  ] loop
    select relrowsecurity, relforcerowsecurity
      into has_rls, has_force
      from pg_class where oid = ('public.' || t)::regclass;
    if not coalesce(has_rls, false) or not coalesce(has_force, false) then
      raise exception 'P0: RLS or FORCE RLS missing on %', t;
    end if;
    select count(*) into n
      from pg_policies
      where schemaname = 'public' and tablename = t;
    if n <> 0 then
      raise exception 'P0: unexpected access policy on %', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
       or has_table_privilege('anon', 'public.' || t, 'SELECT') then
      raise exception 'P0: exposed table privileges on %', t;
    end if;
  end loop;
end $$;
rollback;
