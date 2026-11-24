-- ATLAS Identity invitation acceptance hardening.
-- The authenticated account must own a confirmed email matching the invitation.
begin;

create or replace function public.accept_identity_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invite public.identity_invitations%rowtype;
  account_email text;
  account_email_confirmed_at timestamptz;
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
    raise exception 'Invitation has expired';
  end if;

  select lower(email), email_confirmed_at
  into account_email, account_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if account_email_confirmed_at is null then
    raise exception 'A confirmed email is required to accept an invitation';
  end if;

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
      'role', invite.role,
      'email_confirmed', true
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

revoke execute on function public.accept_identity_invitation(text) from public, anon;
grant execute on function public.accept_identity_invitation(text) to authenticated;

commit;
