do $$
declare
  owner_user uuid;
  atlas_org uuid;
begin
  select id into owner_user from auth.users order by created_at asc limit 1;
  if owner_user is null then
    raise notice 'No auth user exists; ATLAS production tenant bootstrap skipped.';
    return;
  end if;

  select id into atlas_org from public.organizations where created_by=owner_user and lower(name)='atlas' order by created_at asc limit 1;
  if atlas_org is null then
    insert into public.organizations(name,legal_name,industry,active,created_by)
    values('ATLAS',null,'Technology & Professional Services',true,owner_user)
    returning id into atlas_org;
  end if;

  insert into public.organization_members(org_id,user_id,role,status)
  values(atlas_org,owner_user,'owner','active')
  on conflict(org_id,user_id) do update set role='owner',status='active',updated_at=now();

  insert into public.organization_settings(org_id,settings)
  values(atlas_org,'{}'::jsonb)
  on conflict(org_id) do nothing;

  insert into public.chart_of_accounts(org_id,account_number,name,account_type)
  values
    (atlas_org,'1000','Cash','asset'),
    (atlas_org,'1100','Accounts Receivable','asset'),
    (atlas_org,'2000','Accounts Payable','liability'),
    (atlas_org,'4000','Revenue','revenue'),
    (atlas_org,'5000','Expenses','expense')
  on conflict(org_id,account_number) do nothing;

  insert into public.atlas_module_registry(org_id,module_code,enabled,launch_status,data_backend,config)
  select atlas_org,v.module_code,true,'active',v.data_backend,'{}'::jsonb
  from (values
    ('core','core_relational'),('crm','core_relational'),('finance','core_relational'),('accounting','core_relational'),
    ('inventory','core_relational'),('hr','core_relational'),('payroll','module_records'),('documents','core_relational'),
    ('wallet','module_records'),('rewards','module_records'),('ride','module_records'),('marketplace','module_records'),
    ('freight','module_records'),('cars','module_records'),('health','module_records'),('safety','module_records'),
    ('community','module_records'),('projects','module_records'),('pos','module_records'),('education','module_records'),
    ('security','identity_system'),('automation','workflow_engine'),('field_ops','module_records'),('analytics','event_stream'),
    ('intelligence','event_stream'),('calendar','module_records'),('support','module_records')
  ) as v(module_code,data_backend)
  on conflict(org_id,module_code) do update set enabled=true,launch_status='active',data_backend=excluded.data_backend,updated_at=now();

  insert into public.organization_modules(org_id,module_code,enabled,launch_status)
  select org_id,module_code,true,'active' from public.atlas_module_registry where org_id=atlas_org
  on conflict(org_id,module_code) do update set enabled=true,launch_status='active',updated_at=now();
end;
$$;
