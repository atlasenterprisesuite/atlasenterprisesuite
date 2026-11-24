create or replace function public.atlas_bootstrap_owner(p_full_name text, p_organization_name text default 'ATLAS')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_name text := nullif(trim(coalesce(p_organization_name,'')), '');
  v_full text := nullif(trim(coalesce(p_full_name,'')), '');
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;
  if v_full is null or length(v_full) < 2 then
    raise exception 'valid_full_name_required';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'valid_organization_name_required';
  end if;

  insert into public.profiles(id, full_name)
  values (v_user, v_full)
  on conflict (id) do update set full_name=excluded.full_name, updated_at=now();

  select om.org_id into v_org
  from public.organization_members om
  where om.user_id=v_user and om.status='active'
  order by case when om.role='owner' then 0 else 1 end, om.created_at
  limit 1;

  if v_org is null then
    insert into public.organizations(name, legal_name, active, created_by)
    values (v_name, v_name, true, v_user)
    returning id into v_org;

    insert into public.organization_members(org_id,user_id,role,status)
    values (v_org,v_user,'owner','active');
  end if;

  return jsonb_build_object('ok',true,'user_id',v_user,'org_id',v_org,'role','owner');
end;
$$;

revoke all on function public.atlas_bootstrap_owner(text,text) from public;
grant execute on function public.atlas_bootstrap_owner(text,text) to authenticated;
