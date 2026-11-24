create or replace function private.guard_atlas_connect_publication()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_content_changed boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required for ATLAS Connect publication mutations';
  end if;

  if tg_op = 'INSERT' then
    if not public.has_identity_permission(new.org_id, 'studio.draft.create') then
      raise exception 'Permission denied: studio.draft.create';
    end if;
    if new.created_by is distinct from v_uid or new.updated_by is distinct from v_uid then
      raise exception 'Publication actor fields must match the authenticated user';
    end if;
    if new.status <> 'draft' or new.fingerprint is not null or new.receipt_verification is not null or new.published_at is not null or new.provider_reference is not null then
      raise exception 'New ATLAS Connect publications must begin as an unreceipted draft';
    end if;
    if new.destination_key <> 'whatsapp_channel_atlas_news'
       or new.destination_platform <> 'whatsapp_channel'
       or new.destination_name <> 'Atlas Enterprise Suite News'
       or new.destination_public_url <> 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32'
       or new.delivery_capability <> 'manual_handoff' then
      raise exception 'Destination snapshot does not match the verified WhatsApp Channel capability';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id or new.org_id <> old.org_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Immutable publication identity fields cannot be changed';
  end if;
  if new.updated_by is distinct from v_uid then
    raise exception 'updated_by must match the authenticated user';
  end if;

  v_content_changed := row(
    new.destination_key,new.destination_platform,new.destination_name,new.destination_public_url,new.delivery_capability,
    new.internal_title,new.body,new.link,new.content_type,new.media_document_id
  ) is distinct from row(
    old.destination_key,old.destination_platform,old.destination_name,old.destination_public_url,old.delivery_capability,
    old.internal_title,old.body,old.link,old.content_type,old.media_document_id
  );

  if old.status = new.status then
    if old.status <> 'draft' then
      raise exception 'Reviewed publication content/state is immutable without an allowed state transition';
    end if;
    if not public.has_identity_permission(old.org_id, 'studio.draft.edit') then
      raise exception 'Permission denied: studio.draft.edit';
    end if;
    if new.fingerprint is distinct from old.fingerprint
       or new.receipt_verification is distinct from old.receipt_verification
       or new.published_at is distinct from old.published_at
       or new.provider_reference is distinct from old.provider_reference
       or new.attempts is distinct from old.attempts then
      raise exception 'Draft system fields cannot be modified directly';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if v_content_changed then
    raise exception 'Publication content and destination are immutable once a state transition starts';
  end if;

  if old.status = 'draft' and new.status = 'ready' then
    if not public.has_identity_permission(old.org_id, 'studio.draft.edit')
       or not public.has_identity_permission(old.org_id, 'connect.publish.request') then
      raise exception 'Permission denied for draft review/publish request';
    end if;
    new.fingerprint := 'sha256:' || encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'body', coalesce(old.body,''),
            'content_type', old.content_type,
            'delivery_capability', old.delivery_capability,
            'destination_key', old.destination_key,
            'destination_name', old.destination_name,
            'destination_platform', old.destination_platform,
            'destination_public_url', old.destination_public_url,
            'internal_title', old.internal_title,
            'link', old.link,
            'media_document_id', old.media_document_id
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    new.receipt_verification := null;
    new.provider_reference := null;
    new.published_at := null;
  elsif old.status = 'ready' and new.status = 'awaiting_manual_publish' then
    if old.delivery_capability <> 'manual_handoff' then
      raise exception 'Manual handoff is not available for this destination';
    end if;
    if not public.has_identity_permission(old.org_id, 'connect.publish.request') then
      raise exception 'Permission denied: connect.publish.request';
    end if;
    if new.fingerprint is distinct from old.fingerprint then
      raise exception 'Reviewed fingerprint cannot change during handoff';
    end if;
    new.attempts := old.attempts + 1;
    new.receipt_verification := null;
    new.provider_reference := null;
    new.published_at := null;
  elsif old.status = 'awaiting_manual_publish' and new.status = 'published' then
    if not public.has_identity_permission(old.org_id, 'connect.publish.confirm_manual') then
      raise exception 'Permission denied: connect.publish.confirm_manual';
    end if;
    if new.fingerprint is distinct from old.fingerprint then
      raise exception 'Reviewed fingerprint cannot change at confirmation';
    end if;
    new.receipt_verification := 'manual_confirmation';
    new.published_at := now();
  elsif old.status in ('ready','awaiting_manual_publish') and new.status = 'failed' then
    if not public.has_identity_permission(old.org_id, 'connect.publish.request') then
      raise exception 'Permission denied: connect.publish.request';
    end if;
    if new.fingerprint is distinct from old.fingerprint then
      raise exception 'Reviewed fingerprint cannot change on failure';
    end if;
    if new.last_error is null or char_length(btrim(new.last_error)) = 0 then
      raise exception 'A failure requires last_error';
    end if;
    new.receipt_verification := null;
    new.provider_reference := null;
    new.published_at := null;
  elsif old.status = 'failed' and new.status = 'ready' then
    if not public.has_identity_permission(old.org_id, 'connect.publish.retry') then
      raise exception 'Permission denied: connect.publish.retry';
    end if;
    if new.fingerprint is distinct from old.fingerprint then
      raise exception 'Reviewed fingerprint cannot change on retry';
    end if;
    new.last_error := null;
    new.receipt_verification := null;
    new.provider_reference := null;
    new.published_at := null;
  else
    raise exception 'Invalid ATLAS Connect publication transition: % -> %', old.status, new.status;
  end if;

  if new.receipt_verification = 'provider_verified' then
    raise exception 'Provider-verified publication is not enabled in this release';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_atlas_connect_publication() from public;
drop function if exists private.atlas_connect_publication_fingerprint(text,text,text,text,uuid,text,text,text,text,text);
