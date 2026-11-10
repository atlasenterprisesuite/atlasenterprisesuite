create or replace function public.atlas_register_baseline_release(
  p_release_key text,
  p_version text,
  p_components jsonb,
  p_source_ref text default null
) returns uuid
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_id uuid;
  c jsonb;
  v_hash text;
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
  v_meta jsonb;
begin
  if session_user <> 'postgres' and v_role <> 'service_role' then raise exception 'service_role_required'; end if;
  if coalesce(trim(p_release_key),'')='' or length(p_release_key)>160 then raise exception 'invalid_release_key'; end if;
  if coalesce(trim(p_version),'')='' or length(p_version)>120 then raise exception 'invalid_release_version'; end if;
  if jsonb_typeof(p_components)<>'array' or jsonb_array_length(p_components)=0 then raise exception 'baseline_components_required'; end if;
  if exists(select 1 from public.atlas_releases where release_key=p_release_key) then raise exception 'baseline_release_key_exists'; end if;

  insert into public.atlas_releases(org_id,release_key,version,channel,status,manifest_hash,source_ref,metadata,frozen_at)
  values(null,p_release_key,p_version,'production','draft',repeat('0',64),left(p_source_ref,500),jsonb_build_object('baseline',true,'historical_registry_rewritten',false,'normalization_only',true),null)
  returning id into v_id;

  for c in select value from jsonb_array_elements(p_components) loop
    if coalesce(c->>'component_type','') not in ('edge_function','database_migration','web_bundle','worker','runtime','configuration','integration') then raise exception 'invalid_baseline_component_type'; end if;
    if coalesce(c->>'component_key','')='' or length(c->>'component_key')>160 then raise exception 'invalid_baseline_component_key'; end if;
    if coalesce(c->>'artifact_sha256','') !~ '^[0-9a-f]{64}$' then raise exception 'invalid_baseline_component_sha'; end if;
    if coalesce(c->>'target_version','')='' then raise exception 'invalid_baseline_target_version'; end if;
    if coalesce(c->>'provider','') not in ('supabase','github','cloudflare','vercel','atlas-native') then raise exception 'invalid_baseline_provider'; end if;
    if coalesce(c->>'rollback_strategy','') not in ('redeploy_previous','restore_snapshot','forward_fix','manual_only','not_reversible') then raise exception 'invalid_baseline_rollback_strategy'; end if;
    v_meta:=coalesce(c->'metadata','{}'::jsonb);
    if jsonb_typeof(v_meta)<>'object' then raise exception 'invalid_baseline_component_metadata'; end if;
    v_meta:=v_meta - array['authorization','token','password','prompt','email','provider_payload','raw_exception'];

    insert into public.atlas_release_components(
      release_id,component_type,component_key,artifact_ref,artifact_sha256,target_version,provider,deployment_order,
      rollback_strategy,rollback_ref,requires_migration,migration_ref,metadata
    ) values (
      v_id,c->>'component_type',c->>'component_key',left(c->>'artifact_ref',500),c->>'artifact_sha256',c->>'target_version',c->>'provider',
      coalesce((c->>'deployment_order')::int,100),c->>'rollback_strategy',nullif(c->>'rollback_ref',''),coalesce((c->>'requires_migration')::boolean,false),nullif(c->>'migration_ref',''),v_meta
    );
  end loop;

  v_hash:=public.atlas_release_manifest_hash(v_id);
  update public.atlas_releases
  set manifest_hash=v_hash,status='candidate',frozen_at=now(),updated_at=now()
  where id=v_id;
  return v_id;
end;
$$;
revoke all on function public.atlas_register_baseline_release(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.atlas_register_baseline_release(text,text,jsonb,text) to service_role;

create or replace function public.atlas_mirror_promoted_release_registry(p_release_id uuid)
returns void
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
begin
  if session_user <> 'postgres' and v_role <> 'service_role' then raise exception 'service_role_required'; end if;
  if not exists(select 1 from public.atlas_releases where id=p_release_id and status='promoted') then raise exception 'release_not_promoted'; end if;
  -- Intentionally no-op in v1: the legacy registry has a different, web/runtime/hub-specific shape.
  return;
end;
$$;
revoke all on function public.atlas_mirror_promoted_release_registry(uuid) from public,anon,authenticated;
grant execute on function public.atlas_mirror_promoted_release_registry(uuid) to service_role;
