create or replace function public.atlas_enforce_synthetic_e2e_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_email text;
begin
  if new.role in ('owner','admin') then
    select lower(u.email) into v_email from auth.users u where u.id = new.user_id;
    if v_email = 'atlas-intelligence-e2e@atlas.invalid' then
      new.role := 'staff';
    elsif v_email = 'atlas-payroll-e2e@atlas.invalid' then
      new.role := 'manager';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.atlas_enforce_synthetic_e2e_role() from public, anon, authenticated;

drop trigger if exists trg_atlas_enforce_synthetic_e2e_role on public.organization_members;
create trigger trg_atlas_enforce_synthetic_e2e_role
before insert or update of role, user_id on public.organization_members
for each row execute function public.atlas_enforce_synthetic_e2e_role();

update public.organization_members om
set role = case
  when lower(u.email) = 'atlas-intelligence-e2e@atlas.invalid' then 'staff'
  when lower(u.email) = 'atlas-payroll-e2e@atlas.invalid' then 'manager'
  else om.role
end
from auth.users u
where u.id = om.user_id
  and lower(u.email) in ('atlas-intelligence-e2e@atlas.invalid','atlas-payroll-e2e@atlas.invalid')
  and om.role in ('owner','admin');
