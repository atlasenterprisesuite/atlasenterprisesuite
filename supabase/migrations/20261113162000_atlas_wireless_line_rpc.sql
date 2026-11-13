-- Capacity-safe ATLAS Wireless intake: reuse PostgreSQL/PostgREST without another Edge Function.
-- The live Supabase project reached 100/100 Edge Function slots. Never bypass carrier service gates.
-- Public wrappers are SECURITY INVOKER; privileged functions are restricted to private schema.
-- RLS and direct grants on atlas_wireless_line_claims remain DENY by default.

create or replace function private.atlas_wireless_line_claim_actor(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_org_id is null
     or not exists (
       select 1 from public.organization_members
       where org_id = p_org_id and user_id = v_user and status = 'active'
     )
     or not coalesce(public.has_identity_permission(p_org_id, 'wireless.mvno.read'), false) then
    raise exception 'authorization_denied' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

create or replace function private.atlas_wireless_line_claim_list(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare v_user uuid;
declare v_claims jsonb;
begin
  v_user := private.atlas_wireless_line_claim_actor(p_org_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'masked_number', '•••-•••-' || right(e164,4),
    'status', status,
    'created_at', created_at,
    'carrier_verified', false,
    'network_active', false
  ) order by created_at desc), '[]'::jsonb)
  into v_claims
  from (
    select id, e164, status, created_at
    from public.atlas_wireless_line_claims
    where org_id = p_org_id and submitted_by = v_user
    order by created_at desc
    limit 10
  ) own;
  return jsonb_build_object('ok', true, 'claims', v_claims);
end;
$$;

create or replace function private.atlas_wireless_line_claim_submit(
  p_org_id uuid, p_number text, p_ownership_asserted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare v_user uuid;
declare v_number text;
declare v_e164 text;
declare v_row public.atlas_wireless_line_claims%rowtype;
declare v_inserted integer := 0;
begin
  v_user := private.atlas_wireless_line_claim_actor(p_org_id);
  if p_ownership_asserted is distinct from true then
    raise exception 'ownership_assertion_required' using errcode = '22023';
  end if;
  if p_number is null or length(p_number) > 40 then
    raise exception 'invalid_phone_number' using errcode = '22023';
  end if;
  v_number := regexp_replace(btrim(p_number), '[[:space:]().-]', '', 'g');
  v_e164 := case
    when v_number ~ '^[0-9]{10}$' then '+1' || v_number
    when v_number ~ '^1[0-9]{10}$' then '+' || v_number
    else v_number
  end;
  if v_e164 !~ '^[+]1[2-9][0-9]{2}[2-9][0-9]{6}$' then
    raise exception 'invalid_phone_number' using errcode = '22023';
  end if;

  insert into public.atlas_wireless_line_claims
    (org_id, submitted_by, e164, status, ownership_asserted_at)
  values (p_org_id, v_user, v_e164, 'pending_verification', now())
  on conflict (org_id, submitted_by, e164) do nothing
  returning * into v_row;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into v_row
    from public.atlas_wireless_line_claims
    where org_id = p_org_id and submitted_by = v_user and e164 = v_e164;
  end if;
  if v_row.id is null then
    raise exception 'claim_store_unavailable' using errcode = 'XX000';
  end if;

  if v_inserted = 1 then
    insert into public.audit_logs(org_id, user_id, action, table_name, record_id, new_data)
    values (p_org_id, v_user, 'wireless.line.claim.submitted',
      'atlas_wireless_line_claims', v_row.id::text,
      jsonb_build_object('status','pending_verification','number_tail',right(v_e164,4)));
  end if;
  return jsonb_build_object('ok', true, 'claim', jsonb_build_object(
    'id', v_row.id,
    'masked_number', '•••-•••-' || right(v_row.e164,4),
    'status', v_row.status,
    'created_at', v_row.created_at,
    'carrier_verified', false,
    'network_active', false
  ));
end;
$$;

-- PostgREST-exposed public wrappers never run as SECURITY DEFINER.
create or replace function public.atlas_wireless_line_list(p_org_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, pg_temp
as $$ select private.atlas_wireless_line_claim_list(p_org_id); $$;

create or replace function public.atlas_wireless_line_submit(
  p_org_id uuid, p_number text, p_ownership_asserted boolean
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, pg_temp
as $$ select private.atlas_wireless_line_claim_submit(p_org_id, p_number, p_ownership_asserted); $$;

-- No direct table access; only guarded functions receive scoped execute.
grant usage on schema private to authenticated;
revoke all on function private.atlas_wireless_line_claim_actor(uuid) from public, anon, authenticated;
revoke all on function private.atlas_wireless_line_claim_list(uuid) from public, anon, authenticated;
revoke all on function private.atlas_wireless_line_claim_submit(uuid,text,boolean) from public, anon, authenticated;
grant execute on function private.atlas_wireless_line_claim_actor(uuid) to authenticated;
grant execute on function private.atlas_wireless_line_claim_list(uuid) to authenticated;
grant execute on function private.atlas_wireless_line_claim_submit(uuid,text,boolean) to authenticated;
revoke all on function public.atlas_wireless_line_list(uuid) from public, anon;
revoke all on function public.atlas_wireless_line_submit(uuid,text,boolean) from public, anon;
grant execute on function public.atlas_wireless_line_list(uuid) to authenticated;
grant execute on function public.atlas_wireless_line_submit(uuid,text,boolean) to authenticated;

comment on function public.atlas_wireless_line_list(uuid) is
  'Masked private line claims scoped to a live ATLAS authenticated user and organization.';
comment on function public.atlas_wireless_line_submit(uuid,text,boolean) is
  'Self-attested line-intake request only; no ownership proof, porting or activation.';
