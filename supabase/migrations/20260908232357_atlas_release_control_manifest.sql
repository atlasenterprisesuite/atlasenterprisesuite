create extension if not exists pgcrypto with schema extensions;

create or replace function public.atlas_release_manifest_json(p_release_id uuid)
returns jsonb
language sql
stable
set search_path='public','pg_temp'
as $$
  select jsonb_build_object(
    'release',jsonb_build_object(
      'release_key',r.release_key,
      'version',r.version,
      'channel',r.channel,
      'source_ref',r.source_ref
    ),
    'components',coalesce((
      select jsonb_agg(jsonb_build_object(
        'component_type',c.component_type,
        'component_key',c.component_key,
        'artifact_ref',c.artifact_ref,
        'artifact_sha256',c.artifact_sha256,
        'target_version',c.target_version,
        'provider',c.provider,
        'deployment_order',c.deployment_order,
        'rollback_strategy',c.rollback_strategy,
        'rollback_ref',c.rollback_ref,
        'requires_migration',c.requires_migration,
        'migration_ref',c.migration_ref
      ) order by c.deployment_order,c.component_type,c.component_key)
      from public.atlas_release_components c
      where c.release_id=r.id
    ), '[]'::jsonb)
  )
  from public.atlas_releases r
  where r.id=p_release_id;
$$;

create or replace function public.atlas_release_manifest_hash(p_release_id uuid)
returns text
language sql
stable
set search_path='public','extensions','pg_temp'
as $$
  select case when public.atlas_release_manifest_json(p_release_id) is null then null
              else encode(extensions.digest(convert_to(public.atlas_release_manifest_json(p_release_id)::text,'UTF8'),'sha256'),'hex') end;
$$;

create or replace function atlas_private.freeze_release_internal(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','atlas_private','extensions','pg_temp'
as $$
declare
  r public.atlas_releases;
  v_hash text;
  v_count integer;
  v_now timestamptz:=now();
  v_actor uuid:=auth.uid();
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
  v_admin boolean:=false;
begin
  select * into r from public.atlas_releases where id=p_release_id for update;
  if not found then raise exception 'release_not_found'; end if;
  if r.status<>'draft' then raise exception 'release_not_draft'; end if;
  v_admin := session_user='postgres' or v_role='service_role';
  if not v_admin then
    if r.org_id is not null then
      if v_actor is null or not public.has_identity_permission(r.org_id,'releases.manage') then raise exception 'permission_denied'; end if;
    else
      if v_actor is null or not atlas_private.is_release_platform_admin(v_actor) then raise exception 'permission_denied'; end if;
    end if;
  end if;
  select count(*) into v_count from public.atlas_release_components where release_id=p_release_id;
  if v_count=0 then raise exception 'release_has_no_components'; end if;
  if exists(select 1 from public.atlas_release_components where release_id=p_release_id and artifact_sha256 !~ '^[0-9a-f]{64}$') then raise exception 'invalid_artifact_sha256'; end if;
  if exists(select 1 from public.atlas_release_components where release_id=p_release_id and rollback_strategy='redeploy_previous' and coalesce(rollback_ref,'')='') then
    raise exception 'rollback_ref_required_for_redeploy_previous';
  end if;
  v_hash:=public.atlas_release_manifest_hash(p_release_id);
  if v_hash is null or v_hash !~ '^[0-9a-f]{64}$' then raise exception 'manifest_hash_failed'; end if;
  update public.atlas_releases
  set manifest_hash=v_hash,status='candidate',frozen_at=v_now,updated_at=v_now
  where id=p_release_id;
  return jsonb_build_object('id',p_release_id,'status','candidate','manifest_hash',v_hash,'component_count',v_count,'frozen_at',v_now);
end;
$$;
revoke all on function atlas_private.freeze_release_internal(uuid) from public,anon;
grant execute on function atlas_private.freeze_release_internal(uuid) to authenticated,service_role;

create or replace function public.atlas_freeze_release(p_release_id uuid)
returns jsonb
language sql
security invoker
set search_path='public','atlas_private','pg_temp'
as $$ select atlas_private.freeze_release_internal(p_release_id); $$;
revoke all on function public.atlas_freeze_release(uuid) from public,anon;
grant execute on function public.atlas_freeze_release(uuid) to authenticated,service_role;
