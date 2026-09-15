-- Reconcile the authoritative ATLAS Identity RPC surface from atlas-core into
-- canonical source control. These definitions intentionally preserve current
-- production tenant, role, permission, confirmed-email and MFA guards.

CREATE OR REPLACE FUNCTION public.accept_identity_invitation(invitation_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  invite public.identity_invitations%rowtype;
  account_email text;
  account_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to accept an invitation';
  end if;

  if invitation_token is null or length(invitation_token) < 32 or length(invitation_token) > 256 then
    raise exception 'Invalid invitation token';
  end if;

  select * into invite
  from public.identity_invitations
  where token_hash = extensions.digest(invitation_token, 'sha256')
  for update;

  if invite.id is null then
    raise exception 'Invitation not found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;

  if invite.expires_at <= now() then
    raise exception 'Invitation has expired';
  end if;

  select lower(email), email_confirmed_at
  into account_email, account_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if account_email_confirmed_at is null then
    raise exception 'A confirmed email is required to accept an invitation';
  end if;

  if account_email is null or account_email <> lower(invite.email) then
    raise exception 'Invitation email does not match the authenticated account';
  end if;

  if not exists (
    select 1 from public.organizations
    where id = invite.org_id and active = true
  ) then
    raise exception 'Organization is not active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(invite.org_id::text, 0));

  if exists (
    select 1 from public.organization_members
    where org_id = invite.org_id and user_id = auth.uid()
  ) then
    raise exception 'Membership already exists for this account';
  end if;

  insert into public.organization_members(org_id, user_id, role, status)
  values (invite.org_id, auth.uid(), invite.role, 'active');

  update public.identity_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invite.id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    invite.org_id,
    auth.uid(),
    'member_invitation_accepted',
    jsonb_build_object(
      'invitation_id', invite.id,
      'role', invite.role,
      'email_confirmed', true
    )
  );

  return jsonb_build_object(
    'invitation_id', invite.id,
    'organization_id', invite.org_id,
    'role', invite.role,
    'status', 'accepted'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.atlas_list_client_organizations()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.atlas_provision_client_organization(
  p_name text,
  p_legal_name text DEFAULT NULL::text,
  p_industry text DEFAULT NULL::text,
  p_owner_email text DEFAULT NULL::text,
  p_modules text[] DEFAULT ARRAY['core'::text, 'crm'::text, 'accounting'::text, 'inventory'::text, 'hr'::text]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_identity_invitation(
  organization_id uuid,
  invite_email text,
  target_role text,
  expires_in_hours integer DEFAULT 168
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  actor_role text;
  normalized_email text;
  raw_token text;
  invitation_id uuid;
  invitation_expires_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) to create invitations';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  if target_role not in ('admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported invitation role';
  end if;

  if actor_role = 'admin' and target_role = 'admin' then
    raise exception 'Only an owner can invite an admin';
  end if;

  if expires_in_hours < 1 or expires_in_hours > 720 then
    raise exception 'Invitation expiry must be between 1 and 720 hours';
  end if;

  normalized_email := lower(btrim(coalesce(invite_email, '')));
  if length(normalized_email) < 3
     or length(normalized_email) > 320
     or position('@' in normalized_email) <= 1 then
    raise exception 'A valid invitation email is required';
  end if;

  if exists (
    select 1
    from public.organization_members membership
    join auth.users account on account.id = membership.user_id
    where membership.org_id = organization_id
      and lower(account.email) = normalized_email
  ) then
    raise exception 'This account is already a member of the organization';
  end if;

  update public.identity_invitations
  set status = 'expired', updated_at = now()
  where org_id = organization_id
    and lower(email) = normalized_email
    and status = 'pending'
    and expires_at <= now();

  update public.identity_invitations
  set status = 'revoked', updated_at = now()
  where org_id = organization_id
    and lower(email) = normalized_email
    and status = 'pending';

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  invitation_expires_at := now() + make_interval(hours => expires_in_hours);

  insert into public.identity_invitations(
    org_id, email, role, token_hash, invited_by, expires_at
  )
  values (
    organization_id,
    normalized_email,
    target_role,
    extensions.digest(raw_token, 'sha256'),
    auth.uid(),
    invitation_expires_at
  )
  returning id into invitation_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_invitation_created',
    jsonb_build_object(
      'invitation_id', invitation_id,
      'email', normalized_email,
      'role', target_role,
      'expires_at', invitation_expires_at,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );

  return jsonb_build_object(
    'id', invitation_id,
    'email', normalized_email,
    'role', target_role,
    'expires_at', invitation_expires_at,
    'token', raw_token
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization(
  organization_name text,
  organization_legal_name text DEFAULT NULL::text,
  organization_industry text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.list_identity_invitations(organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', invitation.id,
          'email', invitation.email,
          'role', invitation.role,
          'status', case
            when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
            else invitation.status
          end,
          'expires_at', invitation.expires_at,
          'created_at', invitation.created_at,
          'accepted_at', invitation.accepted_at,
          'invited_by', invitation.invited_by,
          'accepted_by', invitation.accepted_by
        )
        order by invitation.created_at desc
      )
      from public.identity_invitations invitation
      where invitation.org_id = organization_id
    ),
    '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_identity_members(organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.has_identity_permission(organization_id, 'members.read') then
    raise exception 'Member read permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', membership.user_id,
          'full_name', profile.full_name,
          'role', membership.role,
          'status', membership.status,
          'created_at', membership.created_at,
          'updated_at', membership.updated_at
        )
        order by
          case membership.role
            when 'owner' then 1
            when 'admin' then 2
            when 'accountant' then 3
            when 'manager' then 4
            when 'staff' then 5
            else 6
          end,
          coalesce(profile.full_name, membership.user_id::text)
      )
      from public.organization_members membership
      left join public.profiles profile on profile.id = membership.user_id
      where membership.org_id = organization_id
    ),
    '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_identity_security_events(organization_id uuid, event_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if event_limit < 1 or event_limit > 200 then
    raise exception 'Event limit must be between 1 and 200';
  end if;

  if not public.has_identity_permission(organization_id, 'security.events.read') then
    raise exception 'Security event read permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(event_row) order by event_row.created_at desc)
      from (
        select
          event.id,
          event.event_type,
          event.actor_user_id,
          profile.full_name as actor_full_name,
          event.metadata,
          event.created_at
        from public.identity_security_events event
        left join public.profiles profile on profile.id = event.actor_user_id
        where event.org_id = organization_id
        order by event.created_at desc
        limit event_limit
      ) event_row
    ),
    '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_identity_invitation(organization_id uuid, invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_role text;
  invitation_role text;
  invitation_status text;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) to revoke invitations';
  end if;

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  select role, status into invitation_role, invitation_status
  from public.identity_invitations
  where id = invitation_id
    and org_id = organization_id
  for update;

  if invitation_role is null then
    raise exception 'Invitation not found';
  end if;

  if actor_role = 'admin' and invitation_role = 'admin' then
    raise exception 'Only an owner can revoke an admin invitation';
  end if;

  if invitation_status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  update public.identity_invitations
  set status = 'revoked', updated_at = now()
  where id = invitation_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_invitation_revoked',
    jsonb_build_object(
      'invitation_id', invitation_id,
      'role', invitation_role,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_identity_member_role(organization_id uuid, target_user_id uuid, target_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_role text;
  previous_role text;
  active_owner_count integer;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for member role changes';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
  end if;

  select role into previous_role
  from public.organization_members
  where org_id = organization_id
    and user_id = target_user_id
  for update;

  if previous_role is null then
    raise exception 'Target member does not exist in this organization';
  end if;

  if actor_role = 'admin' and (previous_role in ('owner','admin') or target_role in ('owner','admin')) then
    raise exception 'Only an owner can manage owner or admin roles';
  end if;

  if previous_role = 'owner' and target_role <> 'owner' then
    select count(*) into active_owner_count
    from public.organization_members
    where org_id = organization_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The organization must retain at least one active owner';
    end if;
  end if;

  update public.organization_members
  set role = target_role,
      updated_at = now()
  where org_id = organization_id
    and user_id = target_user_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_role_changed',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'previous_role', previous_role,
      'role', target_role,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_identity_member_status(organization_id uuid, target_user_id uuid, target_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_role text;
  target_member_role text;
  previous_status text;
  active_owner_count integer;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for member status changes';
  end if;

  if target_status not in ('active','suspended') then
    raise exception 'Unsupported member status';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  select role, status into target_member_role, previous_status
  from public.organization_members
  where org_id = organization_id
    and user_id = target_user_id
  for update;

  if target_member_role is null then
    raise exception 'Target member does not exist in this organization';
  end if;

  if actor_role = 'admin' and target_member_role in ('owner','admin') then
    raise exception 'Only an owner can change owner or admin status';
  end if;

  if target_member_role = 'owner' and previous_status = 'active' and target_status <> 'active' then
    select count(*) into active_owner_count
    from public.organization_members
    where org_id = organization_id
      and role = 'owner'
      and status = 'active';

    if active_owner_count <= 1 then
      raise exception 'The organization must retain at least one active owner';
    end if;
  end if;

  update public.organization_members
  set status = target_status,
      updated_at = now()
  where org_id = organization_id
    and user_id = target_user_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_status_changed',
    jsonb_build_object(
      'target_user_id', target_user_id,
      'role', target_member_role,
      'previous_status', previous_status,
      'status', target_status,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_identity_role_permission(organization_id uuid, target_role text, target_permission text, allow_permission boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_role text;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) for permission changes';
  end if;

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'identity.manage') then
    raise exception 'Identity administration permission required';
  end if;

  if target_role not in ('owner','admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported organization role';
  end if;

  if actor_role = 'admin' and target_role in ('owner','admin') then
    raise exception 'Only an owner can manage owner or admin permissions';
  end if;

  if target_role = 'owner'
     and target_permission = 'identity.manage'
     and allow_permission = false then
    raise exception 'Owner identity.manage permission cannot be denied';
  end if;

  if not exists (select 1 from public.identity_permissions where code = target_permission) then
    raise exception 'Unknown identity permission';
  end if;

  insert into public.organization_role_permissions(org_id, role, permission_code, allowed, updated_by)
  values (organization_id, target_role, target_permission, allow_permission, auth.uid())
  on conflict (org_id, role, permission_code)
  do update set allowed = excluded.allowed, updated_by = auth.uid(), updated_at = now();

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'role_permission_changed',
    jsonb_build_object(
      'role', target_role,
      'permission', target_permission,
      'allowed', allow_permission,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$function$;

-- SECURITY DEFINER RPCs are intentionally available only to authenticated
-- callers. Internal guards above remain authoritative for tenant, role,
-- permission, confirmed-email and AAL2 enforcement.
REVOKE EXECUTE ON FUNCTION public.accept_identity_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_identity_invitation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_identity_invitation(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.atlas_list_client_organizations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_list_client_organizations() FROM anon;
GRANT EXECUTE ON FUNCTION public.atlas_list_client_organizations() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.atlas_provision_client_organization(text,text,text,text,text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_provision_client_organization(text,text,text,text,text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.atlas_provision_client_organization(text,text,text,text,text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_identity_invitation(uuid,text,text,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_identity_invitation(uuid,text,text,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_identity_invitation(uuid,text,text,integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_organization(text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization(text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text,text,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_identity_invitations(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_identity_invitations(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_identity_invitations(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_identity_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_identity_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_identity_members(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_identity_security_events(uuid,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_identity_security_events(uuid,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_identity_security_events(uuid,integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.revoke_identity_invitation(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_identity_invitation(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_identity_invitation(uuid,uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_identity_member_role(uuid,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_identity_member_role(uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_identity_member_role(uuid,uuid,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_identity_member_status(uuid,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_identity_member_status(uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_identity_member_status(uuid,uuid,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_identity_role_permission(uuid,text,text,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_identity_role_permission(uuid,text,text,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_identity_role_permission(uuid,text,text,boolean) TO authenticated;
