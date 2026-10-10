alter table public.identity_invitations drop constraint if exists identity_invitations_role_check;
alter table public.identity_invitations add constraint identity_invitations_role_check check (role = any (array['owner','admin','accountant','manager','staff','viewer']::text[]));

create or replace function public.atlas_master_context()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_org_name text;
  v_role text;
  v_platform_admin boolean := false;
  v_aal text := coalesce(auth.jwt()->>'aal','aal1');
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;

  select exists(
    select 1 from public.atlas_platform_admins a
    where a.user_id=v_user and a.enabled=true
  ) into v_platform_admin;

  select r.org_id,r.org_name,r.role
  into v_org,v_org_name,v_role
  from public.atlas_resolve_default_org() r
  limit 1;

  return jsonb_build_object(
    'user_id',v_user,
    'platform_admin',v_platform_admin,
    'is_master',v_platform_admin and v_role='owner' and lower(coalesce(v_org_name,''))='atlas',
    'default_org_id',v_org,
    'default_org_name',v_org_name,
    'default_org_role',v_role,
    'aal',v_aal,
    'sensitive_operations_ready',v_aal='aal2'
  );
end;
$$;

revoke all on function public.atlas_master_context() from public, anon;
grant execute on function public.atlas_master_context() to authenticated;

create or replace function public.atlas_provision_client_organization(
  p_name text,
  p_legal_name text default null,
  p_industry text default null,
  p_owner_email text default null,
  p_modules text[] default array['core','crm','accounting','inventory','hr']::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_org uuid;
  v_name text := btrim(coalesce(p_name,''));
  v_legal text := nullif(btrim(coalesce(p_legal_name,'')),'');
  v_industry text := nullif(btrim(coalesce(p_industry,'')),'');
  v_email text := lower(btrim(coalesce(p_owner_email,'')));
  v_token text;
  v_invite_id uuid;
  v_expires timestamptz := now() + interval '7 days';
  v_module text;
  v_allowed_modules constant text[] := array['core','crm','accounting','inventory','hr','payroll','projects','documents','ride','pos','analytics','security','settings'];
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_aal2_required';
  end if;
  if not exists(select 1 from public.atlas_platform_admins a where a.user_id=v_actor and a.enabled=true) then
    raise exception 'platform_master_required';
  end if;
  if not exists(select 1 from auth.users u where u.id=v_actor and u.email_confirmed_at is not null) then
    raise exception 'confirmed_email_required';
  end if;
  if length(v_name) < 2 or length(v_name) > 160 then raise exception 'invalid_organization_name'; end if;
  if v_legal is not null and length(v_legal) > 240 then raise exception 'invalid_legal_name'; end if;
  if v_industry is not null and length(v_industry) > 160 then raise exception 'invalid_industry'; end if;
  if length(v_email) < 3 or length(v_email) > 320 or position('@' in v_email) <= 1 then raise exception 'valid_owner_email_required'; end if;
  if p_modules is null or cardinality(p_modules)=0 then p_modules := array['core']::text[]; end if;
  foreach v_module in array p_modules loop
    if not (v_module = any(v_allowed_modules)) then
      raise exception 'unsupported_module:%',v_module;
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended('atlas:client-provision:'||lower(v_name),0));
  if exists(select 1 from public.organizations o where lower(o.name)=lower(v_name) and coalesce(o.active,true)=true) then
    raise exception 'organization_name_already_exists';
  end if;

  insert into public.organizations(name,legal_name,industry,active,created_by)
  values(v_name,v_legal,v_industry,true,v_actor)
  returning id into v_org;

  insert into public.organization_settings(org_id,settings)
  values(v_org,jsonb_build_object('tenant_type','client','provisioned_by_platform',true,'provisioned_at',now()));

  foreach v_module in array p_modules loop
    insert into public.organization_modules(org_id,module_code,enabled,launch_status)
    values(v_org,v_module,true,case when v_module='core' then 'active' else 'beta' end)
    on conflict (org_id,module_code) do update set enabled=excluded.enabled,launch_status=excluded.launch_status,updated_at=now();
  end loop;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.identity_invitations(org_id,email,role,status,token_hash,invited_by,expires_at)
  values(v_org,v_email,'owner','pending',extensions.digest(v_token,'sha256'),v_actor,v_expires)
  returning id into v_invite_id;

  insert into public.identity_security_events(org_id,actor_user_id,event_type,metadata)
  values(v_org,v_actor,'client_organization_provisioned',jsonb_build_object(
    'owner_email',v_email,
    'owner_invitation_id',v_invite_id,
    'modules',p_modules,
    'aal',coalesce(auth.jwt()->>'aal','aal1')
  ));

  return jsonb_build_object(
    'ok',true,
    'organization_id',v_org,
    'organization_name',v_name,
    'owner_email',v_email,
    'owner_invitation_id',v_invite_id,
    'owner_invitation_expires_at',v_expires,
    'owner_invitation_token',v_token,
    'modules',p_modules
  );
end;
$$;

revoke all on function public.atlas_provision_client_organization(text,text,text,text,text[]) from public, anon;
grant execute on function public.atlas_provision_client_organization(text,text,text,text,text[]) to authenticated;

create or replace function public.create_organization(organization_name text, organization_legal_name text default null, organization_industry text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  organization_uuid uuid;
  confirmed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'MFA AAL2 required'; end if;

  select email_confirmed_at into confirmed_at from auth.users where id=auth.uid();
  if confirmed_at is null then raise exception 'A confirmed email is required'; end if;
  if not exists(select 1 from public.atlas_platform_admins admin where admin.user_id=auth.uid() and admin.enabled=true) then
    raise exception 'ATLAS organization bootstrap is restricted to a platform administrator';
  end if;

  organization_name := btrim(coalesce(organization_name,''));
  organization_legal_name := nullif(btrim(coalesce(organization_legal_name,'')),'');
  organization_industry := nullif(btrim(coalesce(organization_industry,'')),'');
  if length(organization_name)<2 or length(organization_name)>160 then raise exception 'Organization name must contain between 2 and 160 characters'; end if;
  if organization_legal_name is not null and length(organization_legal_name)>240 then raise exception 'Organization legal name is too long'; end if;
  if organization_industry is not null and length(organization_industry)>160 then raise exception 'Organization industry is too long'; end if;

  perform pg_advisory_xact_lock(hashtextextended('atlas:platform-bootstrap:'||auth.uid()::text,0));
  insert into public.organizations(name,legal_name,industry,created_by)
  values(organization_name,organization_legal_name,organization_industry,auth.uid()) returning id into organization_uuid;
  insert into public.organization_members(org_id,user_id,role,status,created_at,updated_at)
  values(organization_uuid,auth.uid(),'owner','active',now(),now());
  insert into public.organization_settings(org_id) values(organization_uuid);
  insert into public.organization_modules(org_id,module_code,enabled,launch_status) values
    (organization_uuid,'core',true,'active'),
    (organization_uuid,'crm',true,'beta'),
    (organization_uuid,'accounting',true,'beta'),
    (organization_uuid,'inventory',true,'beta'),
    (organization_uuid,'hr',true,'beta');
  insert into public.chart_of_accounts(org_id,account_number,name,account_type) values
    (organization_uuid,'1000','Cash','asset'),
    (organization_uuid,'1100','Accounts Receivable','asset'),
    (organization_uuid,'2000','Accounts Payable','liability'),
    (organization_uuid,'4000','Revenue','revenue'),
    (organization_uuid,'5000','Expenses','expense');
  return organization_uuid;
end;
$$;
