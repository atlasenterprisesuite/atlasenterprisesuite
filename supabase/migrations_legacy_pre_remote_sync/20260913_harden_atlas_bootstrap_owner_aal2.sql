-- ATLAS Identity hardening: require MFA/AAL2 before platform-owner bootstrap.
-- Reconciles the production SECURITY DEFINER RPC into canonical source control
-- while preserving its existing confirmed-email and platform-admin guards.

CREATE OR REPLACE FUNCTION public.atlas_bootstrap_owner(
  p_full_name text,
  p_organization_name text DEFAULT 'ATLAS'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_name text := nullif(trim(coalesce(p_organization_name,'')), '');
  v_full text := nullif(trim(coalesce(p_full_name,'')), '');
  v_email_confirmed timestamptz;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_aal2_required';
  end if;
  if v_full is null or length(v_full) < 2 then raise exception 'valid_full_name_required'; end if;
  if v_name is null or length(v_name) < 2 then raise exception 'valid_organization_name_required'; end if;

  insert into public.profiles(id, full_name)
  values (v_user, v_full)
  on conflict (id) do update set full_name=excluded.full_name, updated_at=now();

  select om.org_id,om.role into v_org,v_role
  from public.organization_members om
  where om.user_id=v_user and om.status='active'
  order by case when om.role='owner' then 0 else 1 end,om.created_at
  limit 1;

  if v_org is null then
    select email_confirmed_at into v_email_confirmed from auth.users where id=v_user;
    if v_email_confirmed is null then raise exception 'confirmed_email_required'; end if;
    if not exists(
      select 1
      from public.atlas_platform_admins a
      where a.user_id=v_user and a.enabled=true
    ) then
      raise exception 'platform_admin_required_for_organization_bootstrap';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('atlas:owner-bootstrap:'||v_user::text,0));
    select om.org_id,om.role into v_org,v_role
    from public.organization_members om
    where om.user_id=v_user and om.status='active'
    order by case when om.role='owner' then 0 else 1 end,om.created_at
    limit 1;

    if v_org is null then
      insert into public.organizations(name,legal_name,active,created_by)
      values(v_name,v_name,true,v_user) returning id into v_org;
      insert into public.organization_members(org_id,user_id,role,status)
      values(v_org,v_user,'owner','active');
      v_role:='owner';
      insert into public.identity_security_events(org_id,actor_user_id,event_type,metadata)
      values(
        v_org,
        v_user,
        'owner_bootstrap_completed',
        jsonb_build_object('platform_admin_verified',true,'aal','aal2')
      );
    end if;
  end if;

  return jsonb_build_object('ok',true,'user_id',v_user,'org_id',v_org,'role',v_role);
end;
$function$;
