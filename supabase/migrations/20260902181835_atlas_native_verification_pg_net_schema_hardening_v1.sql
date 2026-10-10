drop extension pg_net;
create extension pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pg_net' and n.nspname='extensions'
  ) then
    raise exception 'pg_net_extension_schema_hardening_failed';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='net' and p.proname='http_post'
  ) then
    raise exception 'pg_net_http_post_missing_after_reinstall';
  end if;
end $$;
