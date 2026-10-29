-- AW Finance 777 Cycle 02: forward-only hardening of privileged Advisory writes.
-- All three SECURITY DEFINER functions require active firm membership at request time.
-- Never execute against production before review and isolated database tests.

create or replace function public.advisory_create_client(
  p_firm_id uuid,
  p_display_name text,
  p_email text default null,
  p_phone text default null,
  p_client_type text default 'business'
)
returns setof public.advisory_clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_client uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;
  if not exists (select 1 from public.advisory_firms f where f.id = p_firm_id and f.org_id = v_org and f.status = 'active') then
    raise exception 'Firm not available in active organization';
  end if;
  if not public.is_advisory_firm_member(v_org, p_firm_id) then raise exception 'Active Advisory firm membership required'; end if;
  if length(trim(coalesce(p_display_name,''))) = 0 then raise exception 'Client name required'; end if;
  if p_client_type not in ('person','business') then raise exception 'Invalid client type'; end if;

  insert into public.advisory_clients(org_id, firm_id, display_name, client_type, email, phone, status, owner_id, created_by)
  values (v_org, p_firm_id, trim(p_display_name), p_client_type, nullif(trim(coalesce(p_email,'')),''), nullif(trim(coalesce(p_phone,'')),''), 'active', v_user, v_user)
  returning id into v_client;

  return query select c.* from public.advisory_clients c where c.id = v_client;
end
$$;

create or replace function public.advisory_create_engagement(
  p_firm_id uuid,
  p_client_id uuid,
  p_service_id text,
  p_title text
)
returns setof public.advisory_engagements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_engagement uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;
  if not exists (select 1 from public.advisory_firms f where f.id = p_firm_id and f.org_id = v_org and f.status = 'active') then
    raise exception 'Firm not available in active organization';
  end if;
  if not public.is_advisory_firm_member(v_org, p_firm_id) then raise exception 'Active Advisory firm membership required'; end if;
  if not exists (select 1 from public.advisory_clients c where c.id = p_client_id and c.org_id = v_org and c.firm_id = p_firm_id and c.status <> 'inactive') then
    raise exception 'Client not available in firm';
  end if;
  if length(trim(coalesce(p_service_id,''))) = 0 or length(trim(coalesce(p_title,''))) = 0 then
    raise exception 'Service and title required';
  end if;

  insert into public.advisory_engagements(org_id, firm_id, client_id, service_id, title, status, owner_id, created_by)
  values (v_org, p_firm_id, p_client_id, trim(p_service_id), trim(p_title), 'open', v_user, v_user)
  returning id into v_engagement;

  return query select e.* from public.advisory_engagements e where e.id = v_engagement;
end
$$;

create or replace function public.advisory_set_launch_evidence(
  p_engagement_id uuid,
  p_dimension text,
  p_status text,
  p_evidence_reference text default null,
  p_note text default null
)
returns setof public.advisory_launch_deliverables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_firm uuid;
  v_service text;
  v_row uuid;
begin
  if v_user is null or v_org is null then raise exception 'Authentication and active organization required'; end if;
  if not public.has_identity_permission(v_org, 'advisory.manage') then raise exception 'Advisory manage permission required'; end if;

  select e.firm_id, e.service_id into v_firm, v_service
  from public.advisory_engagements e
  where e.id = p_engagement_id and e.org_id = v_org;

  if v_firm is null then raise exception 'Engagement not available in active organization'; end if;
  if not public.is_advisory_firm_member(v_org, v_firm) then raise exception 'Active Advisory firm membership required'; end if;
  if v_service <> 'business-launch-360' then raise exception 'Launch evidence requires Business Launch 360 engagement'; end if;
  if p_dimension not in ('business_setup','brand','website','contact_channels','crm','payments','accounting','marketing','compliance','analytics') then
    raise exception 'Invalid readiness dimension';
  end if;
  if p_status not in ('pending','verified','rejected') then raise exception 'Invalid evidence status'; end if;
  if p_status = 'verified' and length(trim(coalesce(p_evidence_reference,''))) = 0 then
    raise exception 'Verified evidence requires a reference';
  end if;

  insert into public.advisory_launch_deliverables(
    org_id, firm_id, engagement_id, dimension, status, evidence_reference, note,
    verified_by, verified_at, updated_by
  )
  values (
    v_org, v_firm, p_engagement_id, p_dimension, p_status,
    nullif(trim(coalesce(p_evidence_reference,'')),''),
    nullif(trim(coalesce(p_note,'')),''),
    case when p_status = 'verified' then v_user else null end,
    case when p_status = 'verified' then now() else null end,
    v_user
  )
  on conflict (engagement_id, dimension) do update
  set status = excluded.status,
      evidence_reference = excluded.evidence_reference,
      note = excluded.note,
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning id into v_row;

  return query select d.* from public.advisory_launch_deliverables d where d.id = v_row;
end
$$;
