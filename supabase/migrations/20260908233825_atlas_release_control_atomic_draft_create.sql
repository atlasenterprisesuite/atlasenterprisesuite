create or replace function atlas_private.create_release_draft_internal(
  p_org_id uuid,
  p_release_key text,
  p_version text,
  p_channel text,
  p_source_ref text,
  p_notes text,
  p_metadata jsonb,
  p_components jsonb
) returns uuid
language plpgsql
security definer
set search_path='public','atlas_private','pg_temp'
as $$
declare
  v_id uuid; c jsonb; cm jsonb; v_actor uuid:=auth.uid();
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_admin boolean:=false;
begin
  v_admin:=session_user='postgres' or v_role='service_role';
  if p_org_id is null then raise exception 'organization_required'; end if;
  if not v_admin and (v_actor is null or not public.has_identity_permission(p_org_id,'releases.create')) then raise exception 'permission_denied'; end if;
  if coalesce(p_release_key,'') !~ '^[a-zA-Z0-9._-]{3,160}$' then raise exception 'invalid_release_key'; end if;
  if coalesce(length(p_version),0)<1 or length(p_version)>100 then raise exception 'invalid_release_version'; end if;
  if p_channel not in ('development','staging','production') then raise exception 'invalid_release_channel'; end if;
  if p_metadata is null then p_metadata:='{}'::jsonb; end if;
  if jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>8000 then raise exception 'invalid_release_metadata'; end if;
  if exists(select 1 from jsonb_object_keys(p_metadata) k where k not in ('canary_enabled','canary_percent','github_ci_required','change_class','sensitive_class')) then raise exception 'release_metadata_key_not_allowed'; end if;
  if p_metadata ? 'canary_percent' and ((p_metadata->>'canary_percent') !~ '^[0-9]+$' or (p_metadata->>'canary_percent')::int not between 0 and 100) then raise exception 'invalid_canary_percent'; end if;
  if jsonb_typeof(p_components)<>'array' or jsonb_array_length(p_components)<1 or jsonb_array_length(p_components)>100 then raise exception 'invalid_release_components'; end if;

  insert into public.atlas_releases(org_id,release_key,version,channel,status,source_ref,requested_by,notes,metadata)
  values(p_org_id,p_release_key,p_version,p_channel,'draft',nullif(left(coalesce(p_source_ref,''),500),''),v_actor,left(p_notes,2000),p_metadata)
  returning id into v_id;

  for c in select value from jsonb_array_elements(p_components) loop
    if jsonb_typeof(c)<>'object' then raise exception 'invalid_component'; end if;
    cm:=coalesce(c->'metadata','{}'::jsonb);
    if jsonb_typeof(cm)<>'object' or octet_length(cm::text)>4000 then raise exception 'invalid_component_metadata'; end if;
    if exists(select 1 from jsonb_object_keys(cm) k where k not in ('canary_enabled','canary_percent','github_ci_required','change_class','sensitive_class')) then raise exception 'component_metadata_key_not_allowed'; end if;
    if coalesce(c->>'component_key','') !~ '^[a-zA-Z0-9._:-]{1,160}$' then raise exception 'invalid_component_key'; end if;
    if coalesce(c->>'artifact_sha256','') !~ '^[0-9a-f]{64}$' then raise exception 'invalid_artifact_sha256'; end if;
    if coalesce(c->>'target_version','')='' or length(c->>'target_version')>100 then raise exception 'invalid_component_version'; end if;
    if coalesce(c->>'component_type','') not in ('edge_function','database_migration','web_bundle','worker','runtime','configuration','integration') then raise exception 'invalid_component_type'; end if;
    if coalesce(c->>'provider','') not in ('supabase','github','cloudflare','vercel','atlas-native') then raise exception 'invalid_component_provider'; end if;
    if coalesce(c->>'rollback_strategy','') not in ('redeploy_previous','restore_snapshot','forward_fix','manual_only','not_reversible') then raise exception 'invalid_rollback_strategy'; end if;
    if c->>'rollback_strategy'='redeploy_previous' and coalesce(c->>'rollback_ref','')='' then raise exception 'rollback_ref_required_for_redeploy_previous'; end if;
    if coalesce((c->>'requires_migration')::boolean,false) and coalesce(c->>'migration_ref','')='' then raise exception 'migration_ref_required'; end if;

    insert into public.atlas_release_components(
      release_id,component_type,component_key,artifact_ref,artifact_sha256,target_version,provider,deployment_order,
      rollback_strategy,rollback_ref,requires_migration,migration_ref,metadata
    ) values (
      v_id,c->>'component_type',c->>'component_key',nullif(left(coalesce(c->>'artifact_ref',''),500),''),c->>'artifact_sha256',c->>'target_version',c->>'provider',
      coalesce((c->>'deployment_order')::int,100),c->>'rollback_strategy',nullif(left(coalesce(c->>'rollback_ref',''),500),''),
      coalesce((c->>'requires_migration')::boolean,false),nullif(left(coalesce(c->>'migration_ref',''),500),''),cm
    );
  end loop;
  return v_id;
end;
$$;
revoke all on function atlas_private.create_release_draft_internal(uuid,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function atlas_private.create_release_draft_internal(uuid,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role;

create or replace function public.atlas_create_release_draft(
  p_org_id uuid,
  p_release_key text,
  p_version text,
  p_channel text,
  p_source_ref text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_components jsonb default '[]'::jsonb
) returns uuid
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.create_release_draft_internal(p_org_id,p_release_key,p_version,p_channel,p_source_ref,p_notes,p_metadata,p_components); $$;
revoke all on function public.atlas_create_release_draft(uuid,text,text,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.atlas_create_release_draft(uuid,text,text,text,text,text,jsonb,jsonb) to authenticated,service_role;
