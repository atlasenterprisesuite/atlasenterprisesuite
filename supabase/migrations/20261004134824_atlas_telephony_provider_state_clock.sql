alter table public.atlas_call_sessions
  add column if not exists provider_state_at timestamptz,
  add column if not exists provider_state_event_id text;

create index if not exists atlas_call_sessions_org_provider_state_idx
  on public.atlas_call_sessions (organization_id, provider_state_at desc);

create or replace function public.atlas_apply_call_provider_state(
  p_organization_id uuid,
  p_call_session_id uuid,
  p_event_id text,
  p_state text,
  p_occurred_at timestamptz,
  p_provider_call_id text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state text;
  v_provider_state_at timestamptz;
  v_current_rank integer;
  v_incoming_rank integer;
begin
  if p_occurred_at is null or nullif(trim(p_event_id), '') is null then
    return false;
  end if;

  if p_state not in ('dialing','ringing','connected','completed','failed','canceled','blocked') then
    return false;
  end if;

  select state, provider_state_at
    into v_state, v_provider_state_at
  from public.atlas_call_sessions
  where id = p_call_session_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return false;
  end if;

  if v_state in ('completed','failed','canceled','blocked') then
    return false;
  end if;

  v_current_rank := case v_state
    when 'draft' then 0
    when 'queued' then 1
    when 'dialing' then 2
    when 'ringing' then 3
    when 'connected' then 4
    else 5
  end;

  v_incoming_rank := case p_state
    when 'dialing' then 2
    when 'ringing' then 3
    when 'connected' then 4
    else 5
  end;

  if v_incoming_rank < v_current_rank then
    return false;
  end if;

  if v_provider_state_at is null then
    null;
  elsif p_occurred_at > v_provider_state_at then
    null;
  elsif p_occurred_at = v_provider_state_at then
    null;
  else
    return false;
  end if;

  update public.atlas_call_sessions
  set state = p_state,
      provider_call_id = coalesce(nullif(trim(p_provider_call_id), ''), provider_call_id),
      provider_state_at = p_occurred_at,
      provider_state_event_id = p_event_id,
      connected_at = case
        when p_state = 'connected' then coalesce(connected_at, p_occurred_at)
        else connected_at
      end,
      ended_at = case
        when p_state in ('completed','failed','canceled','blocked') then coalesce(ended_at, p_occurred_at)
        else ended_at
      end,
      updated_at = now()
  where id = p_call_session_id
    and organization_id = p_organization_id;

  return true;
end;
$$;

revoke all on function public.atlas_apply_call_provider_state(uuid,uuid,text,text,timestamptz,text)
  from public, anon, authenticated;

grant execute on function public.atlas_apply_call_provider_state(uuid,uuid,text,text,timestamptz,text)
  to service_role;
