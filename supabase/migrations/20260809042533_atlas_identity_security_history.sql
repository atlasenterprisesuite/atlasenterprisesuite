-- ATLAS Identity guarded security-event history.
-- Direct table reads are replaced by a permission-aware RPC projection.
begin;

create or replace function public.list_identity_security_events(
  organization_id uuid,
  event_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if event_limit < 1 or event_limit > 200 then
    raise exception 'Event limit must be between 1 and 200';
  end if;

  if not public.has_identity_permission(organization_id, 'security.events.read') then
    raise exception 'Security event read permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(event_row) order by event_row.created_at desc)
      from (
        select
          event.id,
          event.event_type,
          event.actor_user_id,
          profile.full_name as actor_full_name,
          event.metadata,
          event.created_at
        from public.identity_security_events event
        left join public.profiles profile on profile.id = event.actor_user_id
        where event.org_id = organization_id
        order by event.created_at desc
        limit event_limit
      ) event_row
    ),
    '[]'::jsonb
  );
end;
$$;

drop policy if exists identity_security_events_read on public.identity_security_events;
revoke select on public.identity_security_events from authenticated;

create policy identity_security_events_deny_direct
on public.identity_security_events
for select
to anon, authenticated
using (false);

revoke execute on function public.list_identity_security_events(uuid,integer) from public, anon;
grant execute on function public.list_identity_security_events(uuid,integer) to authenticated;

comment on function public.list_identity_security_events(uuid,integer) is
  'Intentional SECURITY DEFINER boundary: returns a limited event projection only when security.events.read is effective for the caller.';

commit;
