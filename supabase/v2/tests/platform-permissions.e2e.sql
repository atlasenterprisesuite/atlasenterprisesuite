begin;

-- Runs after the pending platform permission migration in a compatible non-production replay environment.
do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from (values
    ('automation.read'),
    ('automation.execute'),
    ('site-review.read'),
    ('voice.personal.read'),
    ('voice.personal.generate'),
    ('voice.apple.use'),
    ('spatial.read')
  ) required(code)
  where not exists (
    select 1 from public.identity_permissions permission_row
    where permission_row.code = required.code
  );

  if missing_count <> 0 then
    raise exception 'ATLAS platform permissions are incomplete';
  end if;

  if not exists (
    select 1 from public.identity_role_permissions
    where role = 'owner' and permission_code = 'voice.personal.generate'
  ) then
    raise exception 'owner must receive governed Voice generation permission';
  end if;

  if not exists (
    select 1 from public.identity_role_permissions
    where role = 'staff' and permission_code = 'voice.personal.read'
  ) then
    raise exception 'staff self-use identity must be able to read Personal Voice';
  end if;

  if exists (
    select 1 from public.identity_role_permissions
    where role = 'viewer' and permission_code in ('automation.execute','voice.personal.generate')
  ) then
    raise exception 'viewer must not receive sensitive execution/generation permissions';
  end if;
end;
$$;

rollback;
