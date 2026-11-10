-- ATLAS Chat filtered conversation history
-- Adds server-side date filtering and ordering so historical ranges are not limited
-- to the latest client-loaded page.

create or replace function public.atlas_chat_list_conversations(
  p_org_id uuid,
  p_date_field text default 'activity',
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_sort text default 'newest',
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,500),1),2000);
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = v_user
      and om.status = 'active'
  ) then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  if p_date_field not in ('activity','created') then
    raise exception 'chat_date_field_invalid' using errcode = '22023';
  end if;

  if p_sort not in ('newest','oldest') then
    raise exception 'chat_sort_invalid' using errcode = '22023';
  end if;

  return (
    with filtered as (
      select
        c.*,
        cp.last_read_sequence,
        cp.participant_role,
        case
          when p_date_field = 'created' then c.created_at
          else coalesce(c.last_message_at, c.updated_at)
        end as filter_date
      from public.atlas_chat_conversations c
      join public.atlas_chat_participants cp
        on cp.conversation_id = c.id
       and cp.org_id = c.org_id
       and cp.user_id = v_user
       and cp.left_at is null
      where c.org_id = p_org_id
        and (
          p_from is null
          or (
            case
              when p_date_field = 'created' then c.created_at
              else coalesce(c.last_message_at, c.updated_at)
            end
          ) >= p_from
        )
        and (
          p_to is null
          or (
            case
              when p_date_field = 'created' then c.created_at
              else coalesce(c.last_message_at, c.updated_at)
            end
          ) < p_to
        )
    ),
    ranked as (
      select *
      from filtered
      order by
        case when p_sort = 'oldest' then filter_date end asc,
        case when p_sort = 'newest' then filter_date end desc,
        id
      limit v_limit
    )
    select jsonb_build_object(
      'ok', true,
      'total_count', (select count(*) from filtered),
      'truncated', (select count(*) from filtered) > v_limit,
      'conversations', coalesce((
        select jsonb_agg(
          to_jsonb(r) - 'filter_date'
          order by
            case when p_sort = 'oldest' then r.filter_date end asc,
            case when p_sort = 'newest' then r.filter_date end desc,
            r.id
        )
        from ranked r
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.atlas_chat_list_conversations(uuid,text,timestamptz,timestamptz,text,integer) from public, anon;
grant execute on function public.atlas_chat_list_conversations(uuid,text,timestamptz,timestamptz,text,integer) to authenticated, service_role;
