begin;

-- Runs only after the pending Release Train migrations are replayed in a compatible non-production environment.
do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (values ('automations'), ('site-review'), ('spatial')) required(module_code)
  where not exists (
    select 1
    from public.atlas_release_modules module_row
    where module_row.module_code = required.module_code
      and module_row.module_family = 'platform-services'
      and module_row.release_wave = 4
      and module_row.activation_enabled = false
      and 'release-controller' = any(module_row.dependencies)
  );

  if missing_count <> 0 then
    raise exception 'Existing ATLAS platform capabilities are missing from the Release Train catalog';
  end if;
end;
$$;

rollback;
