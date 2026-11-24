create schema if not exists atlas_private;
revoke all on schema atlas_private from public, anon;
grant usage on schema atlas_private to authenticated, service_role;

alter function public.accept_identity_invitation(text) set schema atlas_private;
alter function public.atlas_bootstrap_owner(text,text) set schema atlas_private;
alter function public.create_identity_invitation(uuid,text,text,integer) set schema atlas_private;
alter function public.create_organization(text,text,text) set schema atlas_private;
alter function public.list_identity_invitations(uuid) set schema atlas_private;
alter function public.list_identity_members(uuid) set schema atlas_private;
alter function public.list_identity_security_events(uuid,integer) set schema atlas_private;
alter function public.revoke_identity_invitation(uuid,uuid) set schema atlas_private;
alter function public.set_identity_member_role(uuid,uuid,text) set schema atlas_private;
alter function public.set_identity_member_status(uuid,uuid,text) set schema atlas_private;
alter function public.set_identity_role_permission(uuid,text,text,boolean) set schema atlas_private;

revoke all on function atlas_private.accept_identity_invitation(text) from public, anon;
revoke all on function atlas_private.atlas_bootstrap_owner(text,text) from public, anon;
revoke all on function atlas_private.create_identity_invitation(uuid,text,text,integer) from public, anon;
revoke all on function atlas_private.create_organization(text,text,text) from public, anon;
revoke all on function atlas_private.list_identity_invitations(uuid) from public, anon;
revoke all on function atlas_private.list_identity_members(uuid) from public, anon;
revoke all on function atlas_private.list_identity_security_events(uuid,integer) from public, anon;
revoke all on function atlas_private.revoke_identity_invitation(uuid,uuid) from public, anon;
revoke all on function atlas_private.set_identity_member_role(uuid,uuid,text) from public, anon;
revoke all on function atlas_private.set_identity_member_status(uuid,uuid,text) from public, anon;
revoke all on function atlas_private.set_identity_role_permission(uuid,text,text,boolean) from public, anon;

grant execute on function atlas_private.accept_identity_invitation(text) to authenticated, service_role;
grant execute on function atlas_private.atlas_bootstrap_owner(text,text) to authenticated, service_role;
grant execute on function atlas_private.create_identity_invitation(uuid,text,text,integer) to authenticated, service_role;
grant execute on function atlas_private.create_organization(text,text,text) to authenticated, service_role;
grant execute on function atlas_private.list_identity_invitations(uuid) to authenticated, service_role;
grant execute on function atlas_private.list_identity_members(uuid) to authenticated, service_role;
grant execute on function atlas_private.list_identity_security_events(uuid,integer) to authenticated, service_role;
grant execute on function atlas_private.revoke_identity_invitation(uuid,uuid) to authenticated, service_role;
grant execute on function atlas_private.set_identity_member_role(uuid,uuid,text) to authenticated, service_role;
grant execute on function atlas_private.set_identity_member_status(uuid,uuid,text) to authenticated, service_role;
grant execute on function atlas_private.set_identity_role_permission(uuid,text,text,boolean) to authenticated, service_role;

create function public.accept_identity_invitation(invitation_token text)
returns jsonb language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.accept_identity_invitation(invitation_token); $$;

create function public.atlas_bootstrap_owner(p_full_name text, p_organization_name text default 'ATLAS'::text)
returns jsonb language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.atlas_bootstrap_owner(p_full_name, p_organization_name); $$;

create function public.create_identity_invitation(
  organization_id uuid, invite_email text, target_role text, expires_in_hours integer default 168
)
returns jsonb language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.create_identity_invitation(organization_id, invite_email, target_role, expires_in_hours); $$;

create function public.create_organization(
  organization_name text, organization_legal_name text default null::text, organization_industry text default null::text
)
returns uuid language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.create_organization(organization_name, organization_legal_name, organization_industry); $$;

create function public.list_identity_invitations(organization_id uuid)
returns jsonb language sql stable security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.list_identity_invitations(organization_id); $$;

create function public.list_identity_members(organization_id uuid)
returns jsonb language sql stable security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.list_identity_members(organization_id); $$;

create function public.list_identity_security_events(organization_id uuid, event_limit integer default 50)
returns jsonb language sql stable security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.list_identity_security_events(organization_id, event_limit); $$;

create function public.revoke_identity_invitation(organization_id uuid, invitation_id uuid)
returns void language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.revoke_identity_invitation(organization_id, invitation_id); $$;

create function public.set_identity_member_role(organization_id uuid, target_user_id uuid, target_role text)
returns void language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.set_identity_member_role(organization_id, target_user_id, target_role); $$;

create function public.set_identity_member_status(organization_id uuid, target_user_id uuid, target_status text)
returns void language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.set_identity_member_status(organization_id, target_user_id, target_status); $$;

create function public.set_identity_role_permission(
  organization_id uuid, target_role text, target_permission text, allow_permission boolean
)
returns void language sql security invoker
set search_path = atlas_private, public, pg_temp
as $$ select atlas_private.set_identity_role_permission(organization_id, target_role, target_permission, allow_permission); $$;

revoke all on function public.accept_identity_invitation(text) from public, anon;
revoke all on function public.atlas_bootstrap_owner(text,text) from public, anon;
revoke all on function public.create_identity_invitation(uuid,text,text,integer) from public, anon;
revoke all on function public.create_organization(text,text,text) from public, anon;
revoke all on function public.list_identity_invitations(uuid) from public, anon;
revoke all on function public.list_identity_members(uuid) from public, anon;
revoke all on function public.list_identity_security_events(uuid,integer) from public, anon;
revoke all on function public.revoke_identity_invitation(uuid,uuid) from public, anon;
revoke all on function public.set_identity_member_role(uuid,uuid,text) from public, anon;
revoke all on function public.set_identity_member_status(uuid,uuid,text) from public, anon;
revoke all on function public.set_identity_role_permission(uuid,text,text,boolean) from public, anon;

grant execute on function public.accept_identity_invitation(text) to authenticated, service_role;
grant execute on function public.atlas_bootstrap_owner(text,text) to authenticated, service_role;
grant execute on function public.create_identity_invitation(uuid,text,text,integer) to authenticated, service_role;
grant execute on function public.create_organization(text,text,text) to authenticated, service_role;
grant execute on function public.list_identity_invitations(uuid) to authenticated, service_role;
grant execute on function public.list_identity_members(uuid) to authenticated, service_role;
grant execute on function public.list_identity_security_events(uuid,integer) to authenticated, service_role;
grant execute on function public.revoke_identity_invitation(uuid,uuid) to authenticated, service_role;
grant execute on function public.set_identity_member_role(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.set_identity_member_status(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.set_identity_role_permission(uuid,text,text,boolean) to authenticated, service_role;
