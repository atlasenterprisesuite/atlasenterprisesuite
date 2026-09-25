-- ATLAS Chat Core
-- Tenant-scoped conversations, participants, messages, receipts, reactions, attachment metadata,
-- configurable retention and atomic idempotent message sequencing.

create table if not exists public.atlas_chat_retention_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  retention_days integer null check (retention_days is null or retention_days between 1 and 3650),
  is_default boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create unique index if not exists atlas_chat_retention_default_idx
  on public.atlas_chat_retention_policies(org_id)
  where is_default;

create table if not exists public.atlas_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  created_by uuid not null,
  title text null check (title is null or char_length(title) <= 240),
  channel text not null default 'team'
    check (channel in ('direct','team','support','assistant','system')),
  status text not null default 'active'
    check (status in ('active','closed','archived')),
  classification text not null default 'organization'
    check (classification in ('organization','restricted','confidential')),
  retention_policy_id uuid null references public.atlas_chat_retention_policies(id) on delete set null,
  legal_hold boolean not null default false,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_chat_conversations_org_updated_idx
  on public.atlas_chat_conversations(org_id, updated_at desc);

create table if not exists public.atlas_chat_participants (
  conversation_id uuid not null references public.atlas_chat_conversations(id) on delete cascade,
  org_id uuid not null,
  user_id uuid not null,
  participant_role text not null default 'member'
    check (participant_role in ('member','agent','moderator','owner')),
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  last_read_sequence bigint not null default 0 check (last_read_sequence >= 0),
  primary key (conversation_id, user_id)
);

create index if not exists atlas_chat_participants_user_idx
  on public.atlas_chat_participants(org_id, user_id, joined_at desc);

create table if not exists public.atlas_chat_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null references public.atlas_chat_conversations(id) on delete cascade,
  sender_id uuid null,
  actor_type text not null default 'human'
    check (actor_type in ('human','assistant','agent','automation','system','external')),
  client_message_id uuid not null,
  sequence bigint not null check (sequence > 0),
  content jsonb not null,
  reply_to_message_id uuid null references public.atlas_chat_messages(id) on delete set null,
  edited_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_message_id),
  unique (conversation_id, sequence)
);

create index if not exists atlas_chat_messages_conversation_sequence_idx
  on public.atlas_chat_messages(org_id, conversation_id, sequence);

create table if not exists public.atlas_chat_message_receipts (
  message_id uuid not null references public.atlas_chat_messages(id) on delete cascade,
  org_id uuid not null,
  conversation_id uuid not null references public.atlas_chat_conversations(id) on delete cascade,
  reader_id uuid not null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  primary key (message_id, reader_id)
);

create index if not exists atlas_chat_receipts_reader_idx
  on public.atlas_chat_message_receipts(org_id, conversation_id, reader_id);

create table if not exists public.atlas_chat_message_reactions (
  message_id uuid not null references public.atlas_chat_messages(id) on delete cascade,
  org_id uuid not null,
  conversation_id uuid not null references public.atlas_chat_conversations(id) on delete cascade,
  user_id uuid not null,
  reaction text not null check (char_length(reaction) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create table if not exists public.atlas_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  conversation_id uuid not null references public.atlas_chat_conversations(id) on delete cascade,
  message_id uuid null references public.atlas_chat_messages(id) on delete cascade,
  created_by uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  scan_status text not null default 'pending'
    check (scan_status in ('pending','clean','blocked','failed')),
  created_at timestamptz not null default now(),
  unique (org_id, storage_bucket, storage_path)
);

create or replace function public.atlas_chat_purge_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $
declare
  v_deleted integer := 0;
begin
  with expired as (
    select c.id
    from public.atlas_chat_conversations c
    join public.atlas_chat_retention_policies p
      on p.id = c.retention_policy_id
     and p.org_id = c.org_id
    where c.legal_hold = false
      and p.retention_days is not null
      and coalesce(c.last_message_at, c.updated_at, c.created_at)
        < now() - make_interval(days => p.retention_days)
  ),
  deleted as (
    delete from public.atlas_chat_conversations c
    using expired
    where c.id = expired.id
    returning c.id
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$;

do $
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id
    from cron.job
    where jobname = 'atlas-chat-retention-daily'
    limit 1;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;

    perform cron.schedule(
      'atlas-chat-retention-daily',
      '17 4 * * *',
      'select public.atlas_chat_purge_expired();'
    );
  end if;
end;
$;

create or replace function public.atlas_chat_can_access(
  p_org_id uuid,
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.atlas_chat_participants cp
      on cp.org_id = om.org_id
     and cp.user_id = om.user_id
     and cp.left_at is null
    where om.org_id = p_org_id
      and om.user_id = p_user_id
      and om.status = 'active'
      and cp.conversation_id = p_conversation_id
  );
$$;

create or replace function public.atlas_chat_create_conversation(
  p_org_id uuid,
  p_user_id uuid,
  p_title text,
  p_channel text,
  p_classification text,
  p_participant_user_ids uuid[] default array[]::uuid[]
)
returns public.atlas_chat_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.atlas_chat_conversations;
  v_participants uuid[];
begin
  if p_channel not in ('direct','team','support','assistant','system') then
    raise exception 'chat_channel_invalid' using errcode = '22023';
  end if;
  if p_classification not in ('organization','restricted','confidential') then
    raise exception 'chat_classification_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_members
    where org_id = p_org_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct participant_id), array[p_user_id]::uuid[])
    into v_participants
  from (
    select p_user_id as participant_id
    union all
    select unnest(coalesce(p_participant_user_ids, array[]::uuid[]))
  ) participants;

  if exists (
    select 1
    from unnest(v_participants) participant_id
    where not exists (
      select 1 from public.organization_members om
      where om.org_id = p_org_id
        and om.user_id = participant_id
        and om.status = 'active'
    )
  ) then
    raise exception 'chat_participant_outside_organization' using errcode = '42501';
  end if;

  insert into public.atlas_chat_conversations(
    org_id, created_by, title, channel, classification
  ) values (
    p_org_id,
    p_user_id,
    nullif(left(trim(coalesce(p_title,'')), 240), ''),
    p_channel,
    p_classification
  )
  returning * into v_conversation;

  insert into public.atlas_chat_participants(
    conversation_id, org_id, user_id, participant_role
  )
  select
    v_conversation.id,
    p_org_id,
    participant_id,
    case when participant_id = p_user_id then 'owner' else 'member' end
  from unnest(v_participants) participant_id
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation;
end;
$$;

create or replace function public.atlas_chat_append_message(
  p_org_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_client_message_id uuid,
  p_content jsonb,
  p_actor_type text default 'human'
)
returns public.atlas_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.atlas_chat_messages;
  v_sequence bigint;
  v_message public.atlas_chat_messages;
  v_text text;
begin
  if p_actor_type not in ('human','assistant','agent','automation','system','external') then
    raise exception 'chat_actor_type_invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'chat_content_invalid' using errcode = '22023';
  end if;
  v_text := coalesce(p_content->>'text','');
  if char_length(v_text) < 1 or char_length(v_text) > 12000 then
    raise exception 'chat_message_length_invalid' using errcode = '22023';
  end if;
  if not public.atlas_chat_can_access(p_org_id, p_conversation_id, p_user_id) then
    raise exception 'chat_access_denied' using errcode = '42501';
  end if;

  select *
    into v_existing
  from public.atlas_chat_messages
  where conversation_id = p_conversation_id
    and client_message_id = p_client_message_id;

  if found then
    return v_existing;
  end if;

  update public.atlas_chat_conversations
  set last_sequence = last_sequence + 1,
      last_message_at = now(),
      updated_at = now()
  where id = p_conversation_id
    and org_id = p_org_id
    and status = 'active'
  returning last_sequence into v_sequence;

  if v_sequence is null then
    raise exception 'chat_conversation_not_active' using errcode = '55000';
  end if;

  if (
    select count(*)
    from public.atlas_chat_messages
    where org_id = p_org_id
      and conversation_id = p_conversation_id
      and sender_id = p_user_id
      and created_at > now() - interval '1 second'
  ) >= 5 then
    raise exception 'chat_rate_limited' using errcode = '57014';
  end if;

  insert into public.atlas_chat_messages(
    org_id,
    conversation_id,
    sender_id,
    actor_type,
    client_message_id,
    sequence,
    content
  ) values (
    p_org_id,
    p_conversation_id,
    p_user_id,
    p_actor_type,
    p_client_message_id,
    v_sequence,
    p_content
  )
  returning * into v_message;

  return v_message;
exception
  when unique_violation then
    select *
      into v_existing
    from public.atlas_chat_messages
    where conversation_id = p_conversation_id
      and client_message_id = p_client_message_id;
    if found then return v_existing; end if;
    raise;
end;
$$;

alter table public.atlas_chat_retention_policies enable row level security;
alter table public.atlas_chat_conversations enable row level security;
alter table public.atlas_chat_participants enable row level security;
alter table public.atlas_chat_messages enable row level security;
alter table public.atlas_chat_message_receipts enable row level security;
alter table public.atlas_chat_message_reactions enable row level security;
alter table public.atlas_chat_attachments enable row level security;

drop policy if exists atlas_chat_retention_read on public.atlas_chat_retention_policies;
create policy atlas_chat_retention_read
on public.atlas_chat_retention_policies
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_chat_retention_policies.org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists atlas_chat_conversation_read on public.atlas_chat_conversations;
create policy atlas_chat_conversation_read
on public.atlas_chat_conversations
for select to authenticated
using (public.atlas_chat_can_access(org_id, id, auth.uid()));

drop policy if exists atlas_chat_participant_read on public.atlas_chat_participants;
create policy atlas_chat_participant_read
on public.atlas_chat_participants
for select to authenticated
using (public.atlas_chat_can_access(org_id, conversation_id, auth.uid()));

drop policy if exists atlas_chat_message_read on public.atlas_chat_messages;
create policy atlas_chat_message_read
on public.atlas_chat_messages
for select to authenticated
using (public.atlas_chat_can_access(org_id, conversation_id, auth.uid()));

drop policy if exists atlas_chat_receipt_read on public.atlas_chat_message_receipts;
create policy atlas_chat_receipt_read
on public.atlas_chat_message_receipts
for select to authenticated
using (public.atlas_chat_can_access(org_id, conversation_id, auth.uid()));

drop policy if exists atlas_chat_reaction_read on public.atlas_chat_message_reactions;
create policy atlas_chat_reaction_read
on public.atlas_chat_message_reactions
for select to authenticated
using (public.atlas_chat_can_access(org_id, conversation_id, auth.uid()));

drop policy if exists atlas_chat_attachment_read on public.atlas_chat_attachments;
create policy atlas_chat_attachment_read
on public.atlas_chat_attachments
for select to authenticated
using (
  scan_status = 'clean'
  and public.atlas_chat_can_access(org_id, conversation_id, auth.uid())
);

revoke all on table
  public.atlas_chat_retention_policies,
  public.atlas_chat_conversations,
  public.atlas_chat_participants,
  public.atlas_chat_messages,
  public.atlas_chat_message_receipts,
  public.atlas_chat_message_reactions,
  public.atlas_chat_attachments
from anon;

revoke insert, update, delete on table
  public.atlas_chat_retention_policies,
  public.atlas_chat_conversations,
  public.atlas_chat_participants,
  public.atlas_chat_messages,
  public.atlas_chat_message_receipts,
  public.atlas_chat_message_reactions,
  public.atlas_chat_attachments
from authenticated;

grant select on table
  public.atlas_chat_retention_policies,
  public.atlas_chat_conversations,
  public.atlas_chat_participants,
  public.atlas_chat_messages,
  public.atlas_chat_message_receipts,
  public.atlas_chat_message_reactions,
  public.atlas_chat_attachments
to authenticated;

grant all on table
  public.atlas_chat_retention_policies,
  public.atlas_chat_conversations,
  public.atlas_chat_participants,
  public.atlas_chat_messages,
  public.atlas_chat_message_receipts,
  public.atlas_chat_message_reactions,
  public.atlas_chat_attachments
to service_role;

revoke all on function public.atlas_chat_purge_expired() from public, anon, authenticated;
grant execute on function public.atlas_chat_purge_expired() to service_role;

revoke all on function public.atlas_chat_create_conversation(uuid,uuid,text,text,text,uuid[]) from public, anon, authenticated;
revoke all on function public.atlas_chat_append_message(uuid,uuid,uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.atlas_chat_create_conversation(uuid,uuid,text,text,text,uuid[]) to service_role;
grant execute on function public.atlas_chat_append_message(uuid,uuid,uuid,uuid,jsonb,text) to service_role;

revoke all on function public.atlas_chat_can_access(uuid,uuid,uuid) from public, anon;
grant execute on function public.atlas_chat_can_access(uuid,uuid,uuid) to authenticated, service_role;
