create or replace function public.atlas_list_client_organizations()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'mfa_aal2_required'; end if;
  if not exists(select 1 from public.atlas_platform_admins a where a.user_id=v_actor and a.enabled=true) then
    raise exception 'platform_master_required';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'organization_id',o.id,
      'name',o.name,
      'legal_name',o.legal_name,
      'industry',o.industry,
      'active',o.active,
      'created_at',o.created_at,
      'member_count',(select count(*) from public.organization_members m where m.org_id=o.id),
      'enabled_modules',(select coalesce(jsonb_agg(om.module_code order by om.module_code),'[]'::jsonb) from public.organization_modules om where om.org_id=o.id and coalesce(om.enabled,false)=true)
    ) order by o.created_at desc)
    from public.organizations o
    join public.organization_settings s on s.org_id=o.id
    where s.settings->>'tenant_type'='client'
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.atlas_list_client_organizations() from public,anon;
grant execute on function public.atlas_list_client_organizations() to authenticated;
