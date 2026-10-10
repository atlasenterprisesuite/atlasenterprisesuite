create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.atlas_connect_publications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  destination_key text not null default 'whatsapp_channel_atlas_news',
  destination_platform text not null default 'whatsapp_channel',
  destination_name text not null default 'Atlas Enterprise Suite News',
  destination_public_url text not null default 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
  delivery_capability text not null default 'manual_handoff',
  internal_title text not null,
  body text not null default '',
  link text,
  content_type text not null default 'text',
  media_document_id uuid references public.documents(id) on delete restrict,
  status text not null default 'draft',
  fingerprint text,
  receipt_verification text,
  provider_reference text,
  last_error text,
  attempts integer not null default 0,
  published_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atlas_connect_publications_destination_key_chk check (destination_key ~ '^[a-z0-9][a-z0-9._-]{2,95}$'),
  constraint atlas_connect_publications_platform_chk check (destination_platform = 'whatsapp_channel'),
  constraint atlas_connect_publications_name_chk check (char_length(btrim(destination_name)) between 1 and 160),
  constraint atlas_connect_publications_url_chk check (destination_public_url ~ '^https://[^[:space:]]+$'),
  constraint atlas_connect_publications_capability_chk check (delivery_capability in ('manual_handoff','provider_publish','unavailable')),
  constraint atlas_connect_publications_title_chk check (char_length(btrim(internal_title)) between 1 and 240),
  constraint atlas_connect_publications_type_chk check (content_type in ('text','link','image','video')),
  constraint atlas_connect_publications_status_chk check (status in ('draft','ready','awaiting_manual_publish','publishing','published','failed')),
  constraint atlas_connect_publications_attempts_chk check (attempts between 0 and 100),
  constraint atlas_connect_publications_link_chk check (link is null or link ~ '^https?://[^[:space:]]+$'),
  constraint atlas_connect_publications_content_chk check (
    (content_type = 'text' and char_length(btrim(body)) > 0)
    or (content_type = 'link' and link is not null)
    or (content_type in ('image','video') and media_document_id is not null)
  ),
  constraint atlas_connect_publications_fingerprint_chk check (fingerprint is null or fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  constraint atlas_connect_publications_verification_chk check (receipt_verification is null or receipt_verification in ('manual_confirmation','provider_verified')),
  constraint atlas_connect_publications_receipt_state_chk check (
    (status = 'published' and fingerprint is not null and receipt_verification is not null and published_at is not null)
    or (status <> 'published' and receipt_verification is null and published_at is null and provider_reference is null)
  ),
  constraint atlas_connect_publications_provider_truth_chk check (
    receipt_verification is distinct from 'provider_verified' or delivery_capability = 'provider_publish'
  )
);

comment on table public.atlas_connect_publications is 'ATLAS Connect tenant-scoped publication state. Direct state changes are guarded by RLS plus a transition trigger; audit events are emitted to atlas_events.';
comment on column public.atlas_connect_publications.media_document_id is 'Optional reference to the existing ATLAS documents/storage fabric. Image/video publication records require a persisted document.';
comment on column public.atlas_connect_publications.fingerprint is 'Server-calculated SHA-256 fingerprint of reviewed publication content and destination snapshot.';

alter table public.atlas_connect_publications enable row level security;

revoke all on table public.atlas_connect_publications from anon;
revoke all on table public.atlas_connect_publications from authenticated;
grant select, insert, update on table public.atlas_connect_publications to authenticated;
grant select, insert, update, delete on table public.atlas_connect_publications to service_role;

insert into public.identity_permissions(code, description) values
  ('studio.draft.create','Create Creator Studio publication drafts'),
  ('studio.draft.edit','Edit Creator Studio publication drafts and prepare reviewed content'),
  ('connect.destination.read','Read ATLAS Connect destination capability state'),
  ('connect.publish.request','Request or start an ATLAS Connect publication handoff'),
  ('connect.publish.confirm_manual','Confirm a manual external publication after the user actually publishes it'),
  ('connect.publish.retry','Retry a failed ATLAS Connect publication flow'),
  ('connect.audit.read','Read ATLAS Connect publication history and audit state')
on conflict (code) do update set description = excluded.description;

insert into public.identity_role_permissions(role, permission_code)
select role, permission_code
from (values
  ('owner','studio.draft.create'),('admin','studio.draft.create'),('manager','studio.draft.create'),('staff','studio.draft.create'),
  ('owner','studio.draft.edit'),('admin','studio.draft.edit'),('manager','studio.draft.edit'),('staff','studio.draft.edit'),
  ('owner','connect.destination.read'),('admin','connect.destination.read'),('manager','connect.destination.read'),('accountant','connect.destination.read'),('staff','connect.destination.read'),('viewer','connect.destination.read'),
  ('owner','connect.publish.request'),('admin','connect.publish.request'),('manager','connect.publish.request'),
  ('owner','connect.publish.confirm_manual'),('admin','connect.publish.confirm_manual'),('manager','connect.publish.confirm_manual'),
  ('owner','connect.publish.retry'),('admin','connect.publish.retry'),('manager','connect.publish.retry'),
  ('owner','connect.audit.read'),('admin','connect.audit.read'),('manager','connect.audit.read')
) as defaults(role, permission_code)
on conflict (role, permission_code) do nothing;

create index if not exists atlas_connect_publications_org_status_updated_idx
  on public.atlas_connect_publications(org_id, status, updated_at desc);
create index if not exists atlas_connect_publications_org_destination_updated_idx
  on public.atlas_connect_publications(org_id, destination_key, updated_at desc);
create index if not exists atlas_connect_publications_created_by_idx
  on public.atlas_connect_publications(created_by);
create index if not exists atlas_connect_publications_updated_by_idx
  on public.atlas_connect_publications(updated_by);
create index if not exists atlas_connect_publications_media_document_idx
  on public.atlas_connect_publications(media_document_id)
  where media_document_id is not null;

create or replace function private.atlas_connect_publication_fingerprint(
  p_internal_title text,
  p_body text,
  p_link text,
  p_content_type text,
  p_media_document_id uuid,
  p_destination_key text,
  p_destination_platform text,
  p_destination_name text,
  p_destination_public_url text,
  p_delivery_capability text
) returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select 'sha256:' || encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'body', coalesce(p_body,''),
          'content_type', p_content_type,
          'delivery_capability', p_delivery_capability,
          'destination_key', p_destination_key,
          'destination_name', p_destination_name,
          'destination_platform', p_destination_platform,
          'destination_public_url', p_destination_public_url,
          'internal_title', p_internal_title,
          'link', p_link,
          'media_document_id', p_media_document_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.atlas_connect_publication_fingerprint(text,text,text,text,uuid,text,text,text,text,text) from public;

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
    new.fingerprint := private.atlas_connect_publication_fingerprint(
      old.internal_title,old.body,old.link,old.content_type,old.media_document_id,
      old.destination_key,old.destination_platform,old.destination_name,old.destination_public_url,old.delivery_capability
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

drop trigger if exists atlas_connect_publication_guard on public.atlas_connect_publications;
create trigger atlas_connect_publication_guard
before insert or update on public.atlas_connect_publications
for each row execute function private.guard_atlas_connect_publication();

create or replace function private.audit_atlas_connect_publication()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'connect.publication.draft_saved';
  elsif new.status is distinct from old.status then
    v_event_type := case new.status
      when 'ready' then 'connect.publication.marked_ready'
      when 'awaiting_manual_publish' then 'connect.publication.handoff_started'
      when 'published' then 'connect.publication.manual_publish_confirmed'
      when 'failed' then 'connect.publication.failed'
      else 'connect.publication.state_changed'
    end;
  else
    v_event_type := 'connect.publication.draft_updated';
  end if;

  insert into public.atlas_events(
    org_id,event_type,source_module,target_module,entity_type,entity_id,payload,actor_id,occurred_at
  ) values (
    new.org_id,
    v_event_type,
    'connect',
    'creator_studio',
    'connect_publication',
    new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'status',new.status,
      'destination_key',new.destination_key,
      'delivery_capability',new.delivery_capability,
      'fingerprint',new.fingerprint,
      'receipt_verification',new.receipt_verification,
      'provider_reference',new.provider_reference,
      'attempts',new.attempts
    )),
    auth.uid(),
    now()
  );
  return new;
end;
$$;

revoke all on function private.audit_atlas_connect_publication() from public;

drop trigger if exists atlas_connect_publication_audit on public.atlas_connect_publications;
create trigger atlas_connect_publication_audit
after insert or update on public.atlas_connect_publications
for each row execute function private.audit_atlas_connect_publication();

drop policy if exists atlas_connect_publications_read on public.atlas_connect_publications;
create policy atlas_connect_publications_read on public.atlas_connect_publications
for select to authenticated
using (
  public.has_identity_permission(org_id,'studio.draft.edit')
  or public.has_identity_permission(org_id,'connect.audit.read')
);

drop policy if exists atlas_connect_publications_insert on public.atlas_connect_publications;
create policy atlas_connect_publications_insert on public.atlas_connect_publications
for insert to authenticated
with check (
  public.has_identity_permission(org_id,'studio.draft.create')
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and status = 'draft'
);

drop policy if exists atlas_connect_publications_update on public.atlas_connect_publications;
create policy atlas_connect_publications_update on public.atlas_connect_publications
for update to authenticated
using (public.is_org_member(org_id))
with check (
  public.is_org_member(org_id)
  and updated_by = (select auth.uid())
);
