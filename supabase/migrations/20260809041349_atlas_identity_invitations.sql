-- ATLAS Identity secure invitation lifecycle.
-- Invitation tokens are returned once to the creator and only SHA-256 hashes are stored.
begin;

create table if not exists public.identity_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','accountant','manager','staff','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists identity_invitations_pending_org_email_idx
  on public.identity_invitations(org_id, lower(email))
  where status = 'pending';

create index if not exists identity_invitations_org_status_created_idx
  on public.identity_invitations(org_id, status, created_at desc);

create index if not exists identity_invitations_expires_idx
  on public.identity_invitations(expires_at)
  where status = 'pending';

alter table public.identity_invitations enable row level security;
revoke all on public.identity_invitations from anon, authenticated;

create or replace function public.create_identity_invitation(
  organization_id uuid,
  invite_email text,
  target_role text,
  expires_in_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  actor_role text;
  normalized_email text;
  raw_token text;
  invitation_id uuid;
  invitation_expires_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) to create invitations';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(organization_id::text, 0));

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  if target_role not in ('admin','accountant','manager','staff','viewer') then
    raise exception 'Unsupported invitation role';
  end if;

  if actor_role = 'admin' and target_role = 'admin' then
    raise exception 'Only an owner can invite an admin';
  end if;

  if expires_in_hours < 1 or expires_in_hours > 720 then
    raise exception 'Invitation expiry must be between 1 and 720 hours';
  end if;

  normalized_email := lower(btrim(coalesce(invite_email, '')));
  if length(normalized_email) < 3
     or length(normalized_email) > 320
     or position('@' in normalized_email) <= 1 then
    raise exception 'A valid invitation email is required';
  end if;

  if exists (
    select 1
    from public.organization_members membership
    join auth.users account on account.id = membership.user_id
    where membership.org_id = organization_id
      and lower(account.email) = normalized_email
  ) then
    raise exception 'This account is already a member of the organization';
  end if;

  update public.identity_invitations
  set status = 'expired', updated_at = now()
  where org_id = organization_id
    and lower(email) = normalized_email
    and status = 'pending'
    and expires_at <= now();

  update public.identity_invitations
  set status = 'revoked', updated_at = now()
  where org_id = organization_id
    and lower(email) = normalized_email
    and status = 'pending';

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  invitation_expires_at := now() + make_interval(hours => expires_in_hours);

  insert into public.identity_invitations(
    org_id, email, role, token_hash, invited_by, expires_at
  )
  values (
    organization_id,
    normalized_email,
    target_role,
    extensions.digest(raw_token, 'sha256'),
    auth.uid(),
    invitation_expires_at
  )
  returning id into invitation_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_invitation_created',
    jsonb_build_object(
      'invitation_id', invitation_id,
      'email', normalized_email,
      'role', target_role,
      'expires_at', invitation_expires_at,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );

  return jsonb_build_object(
    'id', invitation_id,
    'email', normalized_email,
    'role', target_role,
    'expires_at', invitation_expires_at,
    'token', raw_token
  );
end;
$$;

create or replace function public.list_identity_invitations(organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', invitation.id,
          'email', invitation.email,
          'role', invitation.role,
          'status', case
            when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
            else invitation.status
          end,
          'expires_at', invitation.expires_at,
          'created_at', invitation.created_at,
          'accepted_at', invitation.accepted_at,
          'invited_by', invitation.invited_by,
          'accepted_by', invitation.accepted_by
        )
        order by invitation.created_at desc
      )
      from public.identity_invitations invitation
      where invitation.org_id = organization_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.revoke_identity_invitation(
  organization_id uuid,
  invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  invitation_role text;
  invitation_status text;
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'ATLAS Identity requires MFA step-up (AAL2) to revoke invitations';
  end if;

  select role into actor_role
  from public.organization_members
  where org_id = organization_id
    and user_id = auth.uid()
    and status = 'active';

  if actor_role not in ('owner','admin')
     or not public.has_identity_permission(organization_id, 'members.manage') then
    raise exception 'Member administration permission required';
  end if;

  select role, status into invitation_role, invitation_status
  from public.identity_invitations
  where id = invitation_id
    and org_id = organization_id
  for update;

  if invitation_role is null then
    raise exception 'Invitation not found';
  end if;

  if actor_role = 'admin' and invitation_role = 'admin' then
    raise exception 'Only an owner can revoke an admin invitation';
  end if;

  if invitation_status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  update public.identity_invitations
  set status = 'revoked', updated_at = now()
  where id = invitation_id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    organization_id,
    auth.uid(),
    'member_invitation_revoked',
    jsonb_build_object(
      'invitation_id', invitation_id,
      'role', invitation_role,
      'actor_role', actor_role,
      'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
    )
  );
end;
$$;

create or replace function public.accept_identity_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invite public.identity_invitations%rowtype;
  account_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to accept an invitation';
  end if;

  if invitation_token is null or length(invitation_token) < 32 or length(invitation_token) > 256 then
    raise exception 'Invalid invitation token';
  end if;

  select * into invite
  from public.identity_invitations
  where token_hash = extensions.digest(invitation_token, 'sha256')
  for update;

  if invite.id is null then
    raise exception 'Invitation not found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;

  if invite.expires_at <= now() then
    update public.identity_invitations
    set status = 'expired', updated_at = now()
    where id = invite.id;
    raise exception 'Invitation has expired';
  end if;

  select lower(email) into account_email
  from auth.users
  where id = auth.uid();

  if account_email is null or account_email <> lower(invite.email) then
    raise exception 'Invitation email does not match the authenticated account';
  end if;

  if not exists (
    select 1 from public.organizations
    where id = invite.org_id and active = true
  ) then
    raise exception 'Organization is not active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(invite.org_id::text, 0));

  if exists (
    select 1 from public.organization_members
    where org_id = invite.org_id and user_id = auth.uid()
  ) then
    raise exception 'Membership already exists for this account';
  end if;

  insert into public.organization_members(org_id, user_id, role, status)
  values (invite.org_id, auth.uid(), invite.role, 'active');

  update public.identity_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = invite.id;

  insert into public.identity_security_events(org_id, actor_user_id, event_type, metadata)
  values (
    invite.org_id,
    auth.uid(),
    'member_invitation_accepted',
    jsonb_build_object(
      'invitation_id', invite.id,
      'role', invite.role
    )
  );

  return jsonb_build_object(
    'invitation_id', invite.id,
    'organization_id', invite.org_id,
    'role', invite.role,
    'status', 'accepted'
  );
end;
$$;

revoke execute on function public.create_identity_invitation(uuid,text,text,integer) from public, anon;
revoke execute on function public.list_identity_invitations(uuid) from public, anon;
revoke execute on function public.revoke_identity_invitation(uuid,uuid) from public, anon;
revoke execute on function public.accept_identity_invitation(text) from public, anon;

grant execute on function public.create_identity_invitation(uuid,text,text,integer) to authenticated;
grant execute on function public.list_identity_invitations(uuid) to authenticated;
grant execute on function public.revoke_identity_invitation(uuid,uuid) to authenticated;
grant execute on function public.accept_identity_invitation(text) to authenticated;

commit;
