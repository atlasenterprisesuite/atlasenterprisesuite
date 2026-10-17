-- ATLAS Remote Assist: server-authorized, auditable, view-only room handshake.
-- Stores ONLY SHA-256 digests of temporary SDP offers/answers, not SDP, tokens or media.
-- Direct SQL access is restricted to the service role. The Edge API verifies the
-- current JWT and active organization membership again on EVERY operation.
create table if not exists public.atlas_remote_assist_sessions (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  host_user_id uuid not null,
  viewer_user_id uuid,
  status text not null default 'invited'
    check (status in ('invited','joined','approved','answer_ready','active','revoked')),
  offer_sha256 text not null check (offer_sha256 ~ '^[a-f0-9]{64}$'),
  answer_sha256 text check (answer_sha256 is null or answer_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  constraint atlas_remote_assist_viewer_not_host check (viewer_user_id is null or viewer_user_id <> host_user_id)
);
create index if not exists atlas_remote_assist_org_expires_idx
  on public.atlas_remote_assist_sessions (org_id, expires_at desc);
create index if not exists atlas_remote_assist_viewer_idx
  on public.atlas_remote_assist_sessions (org_id, viewer_user_id) where viewer_user_id is not null;
alter table public.atlas_remote_assist_sessions enable row level security;
alter table public.atlas_remote_assist_sessions force row level security;
revoke all on table public.atlas_remote_assist_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.atlas_remote_assist_sessions to service_role;

-- SECURITY DEFINER acts as one transaction for state transition + audit.
-- The function never accepts caller-supplied permissions or participant roles.
create or replace function public.atlas_remote_assist_event(
  p_action text, p_org_id uuid, p_actor_id uuid,
  p_session_id uuid, p_digest text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.atlas_remote_assist_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_state text;
begin
  if p_action not in ('create','join','approve','answer','activate','status','stop')
     or p_org_id is null or p_actor_id is null or p_session_id is null then
    raise exception 'invalid_remote_assist_operation' using errcode = '22023';
  end if;

  -- Independent DB enforcement even if the Edge permission resolver regresses.
  if not exists (
    select 1 from public.organization_members om
    where om.org_id = p_org_id and om.user_id = p_actor_id
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'platform_admin')
  ) then
    raise exception 'remote_assist_member_permission_required' using errcode = '42501';
  end if;

  if p_action = 'create' then
    if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then
      raise exception 'offer_digest_required' using errcode = '22023';
    end if;
    insert into public.atlas_remote_assist_sessions (
      id, org_id, host_user_id, offer_sha256, created_at, updated_at, expires_at
    ) values (
      p_session_id, p_org_id, p_actor_id, p_digest, v_now, v_now, v_now + interval '30 minutes'
    ) returning * into v_session;
  else
    select * into v_session
    from public.atlas_remote_assist_sessions
    where id = p_session_id and org_id = p_org_id
    for update;
    if not found then raise exception 'remote_assist_session_not_found' using errcode = '42501'; end if;

    -- Revalidate BOTH participant memberships before any status read or action.
    -- Revoking either membership must also stop the other browser on its next
    -- short authorization heartbeat, not just revoke the departing user's token.
    if p_action <> 'stop' and (
      not exists (
      select 1 from public.organization_members om
      where om.org_id = p_org_id and om.user_id = v_session.host_user_id
        and om.status = 'active'
        and om.role in ('owner', 'admin', 'platform_admin')
    ) or (
      v_session.viewer_user_id is not null and not exists (
        select 1 from public.organization_members om
        where om.org_id = p_org_id and om.user_id = v_session.viewer_user_id
          and om.status = 'active'
          and om.role in ('owner', 'admin', 'platform_admin')
      )
    )) then
      raise exception 'remote_assist_peer_membership_revoked' using errcode = '42501';
    end if;

    if p_action = 'join' then
      if v_session.host_user_id = p_actor_id
         or v_session.viewer_user_id is not null
         or v_session.status <> 'invited'
         or v_session.created_at + interval '10 minutes' <= v_now
         or v_session.expires_at <= v_now
         or p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
         or v_session.offer_sha256 <> p_digest then
        raise exception 'remote_assist_invitation_unavailable' using errcode = '42501';
      end if;
      update public.atlas_remote_assist_sessions
      set viewer_user_id=p_actor_id, status='joined', updated_at=v_now
      where id = p_session_id returning * into v_session;
    else
      if p_actor_id <> v_session.host_user_id
         and (v_session.viewer_user_id is null or p_actor_id <> v_session.viewer_user_id) then
        raise exception 'remote_assist_actor_denied' using errcode = '42501';
      end if;
      if p_action <> 'stop' and
         (v_session.status = 'revoked' or v_session.expires_at <= v_now) then
        raise exception 'remote_assist_session_unavailable' using errcode = '42501';
      end if;

      if p_action = 'approve' then
        if p_actor_id <> v_session.host_user_id or v_session.status <> 'joined'
           or v_session.viewer_user_id is null
           or not exists (
             select 1 from public.organization_members om
             where om.org_id=p_org_id and om.user_id=v_session.viewer_user_id
               and om.status='active' and om.role in ('owner','admin','platform_admin')
           ) then
          raise exception 'remote_assist_approval_denied' using errcode='42501';
        end if;
        update public.atlas_remote_assist_sessions
        set status='approved',updated_at=v_now where id=p_session_id returning * into v_session;
      elsif p_action = 'answer' then
        if p_actor_id <> v_session.viewer_user_id or v_session.status <> 'approved'
           or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then
          raise exception 'remote_assist_answer_denied' using errcode='42501';
        end if;
        update public.atlas_remote_assist_sessions
        set answer_sha256=p_digest,status='answer_ready',updated_at=v_now
        where id=p_session_id returning * into v_session;
      elsif p_action = 'activate' then
        if p_actor_id <> v_session.host_user_id or v_session.status <> 'answer_ready'
           or p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
           or v_session.answer_sha256 is null or v_session.answer_sha256 <> p_digest then
          raise exception 'remote_assist_activation_denied' using errcode='42501';
        end if;
        update public.atlas_remote_assist_sessions
        set status='active',updated_at=v_now where id=p_session_id returning * into v_session;
      elsif p_action = 'stop' then
        if v_session.status <> 'revoked' then
          update public.atlas_remote_assist_sessions
          set status='revoked',updated_at=v_now where id=p_session_id returning * into v_session;
        end if;
      end if;
    end if;
  end if;

  -- Audit is in the same transaction as mutation. Missing audit => rollback.
  -- No SDP, ICE candidates, fingerprints, token, device metadata or screen content.
  if p_action <> 'status' then
    insert into public.audit_logs (org_id,user_id,action,table_name,record_id,new_data)
    values (
      p_org_id,p_actor_id,'remote_assist.' || p_action,
      'atlas_remote_assist_sessions',p_session_id::text,
      jsonb_build_object('state',v_session.status,'view_only',true)
    );
  end if;

  return jsonb_build_object(
    'id',v_session.id,
    'org_id',v_session.org_id,
    'host_user_id',v_session.host_user_id,
    'viewer_user_id',v_session.viewer_user_id,
    'status',v_session.status,
    'offer_sha256',v_session.offer_sha256,
    'answer_sha256',v_session.answer_sha256,
    'expires_at',v_session.expires_at
  );
end;
$$;
revoke all on function public.atlas_remote_assist_event(text,uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.atlas_remote_assist_event(text,uuid,uuid,uuid,text)
  to service_role;
comment on table public.atlas_remote_assist_sessions is
  'View-only opt-in Remote Assist room handshake. No SDP or media retained. ATLAS RBAC+audit enforced per operation.';
