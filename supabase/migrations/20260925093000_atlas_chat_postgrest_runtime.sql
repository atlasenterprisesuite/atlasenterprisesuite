-- ATLAS Chat PostgREST runtime
-- Consolidates authenticated chat operations behind one database RPC so the production
-- runtime does not require a new Edge Function slot.

create or replace function public.atlas_chat_api(
  p_api text,
  p_org_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_conversation_id uuid;
  v_message_id uuid;
  v_client_message_id uuid;
  v_target_user uuid;
  v_sequence bigint;
  v_previous_sequence bigint;
  v_conversation public.atlas_chat_conversations;
  v_message public.atlas_chat_messages;
  v_row public.atlas_chat_deletion_requests;
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select role into v_role
  from public.organization_members
  where org_id = p_org_id
    and user_id = v_user
    and status = 'active'
  limit 1;

  if v_role is null then
    raise exception 'organization_membership_required' using errcode = '42501';
  end if;

  if p_api = 'readiness' then
    return jsonb_build_object(
      'ok', true,
      'service', 'atlas-chat-postgrest',
      'version', '2026-09-25.2',
      'authenticated', true,
      'organization_id', p_org_id,
      'user_id', v_user,
      'realtime', jsonb_build_object('transport','cloudflare-durable-object','fallback','polling'),
      'attachments', jsonb_build_object('schema_ready',true,'upload_enabled',false,'reason','malware_scan_not_configured'),
      'privacy', jsonb_build_object('export_enabled',true,'deletion_request_enabled',true,'legal_hold_enforced',true)
    );
  end if;

  if p_api = 'members' then
    return jsonb_build_object(
      'ok', true,
      'members', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', om.user_id,
          'role', om.role,
          'full_name', coalesce(p.full_name, 'ATLAS member')
        ) order by coalesce(p.full_name, 'ATLAS member'))
        from public.organization_members om
        left join public.profiles p on p.id = om.user_id
        where om.org_id = p_org_id and om.status = 'active'
      ), '[]'::jsonb)
    );
  end if;

  if p_api = 'conversations' then
    return jsonb_build_object(
      'ok', true,
      'conversations', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
        from (
          select c.*,
                 cp.last_read_sequence,
                 cp.participant_role
          from public.atlas_chat_conversations c
          join public.atlas_chat_participants cp
            on cp.conversation_id = c.id
           and cp.org_id = c.org_id
           and cp.user_id = v_user
           and cp.left_at is null
          where c.org_id = p_org_id
          order by c.updated_at desc
          limit 100
        ) x
      ), '[]'::jsonb)
    );
  end if;

  if p_api = 'messages' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    v_sequence := greatest(coalesce((p_payload->>'after_sequence')::bigint,0),0);
    return jsonb_build_object(
      'ok', true,
      'messages', coalesce((
        select jsonb_agg(to_jsonb(m) order by m.sequence)
        from (
          select id,org_id,conversation_id,sender_id,actor_type,client_message_id,sequence,trace_id,
                 content,reply_to_message_id,edited_at,deleted_at,created_at
          from public.atlas_chat_messages
          where org_id = p_org_id
            and conversation_id = v_conversation_id
            and sequence > v_sequence
          order by sequence
          limit 200
        ) m
      ), '[]'::jsonb)
    );
  end if;

  if p_api = 'conversation' then
    select * into v_conversation
    from public.atlas_chat_create_conversation(
      p_org_id,
      v_user,
      coalesce(p_payload->>'title',''),
      coalesce(p_payload->>'channel','team'),
      coalesce(p_payload->>'classification','organization'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'participant_user_ids','[]'::jsonb))::uuid), array[]::uuid[])
    );

    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
    values (p_org_id,v_user,'communications.chat.conversation.created','atlas_chat',v_conversation.id::text,
      jsonb_build_object('channel',v_conversation.channel,'classification',v_conversation.classification));

    return jsonb_build_object('ok',true,'conversation',to_jsonb(v_conversation));
  end if;

  if p_api = 'message' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    v_client_message_id := nullif(p_payload->>'client_message_id','')::uuid;
    select * into v_message
    from public.atlas_chat_append_message(
      p_org_id,
      v_user,
      v_conversation_id,
      v_client_message_id,
      jsonb_build_object('text',coalesce(p_payload->>'text','')),
      'human'
    );

    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
    values (p_org_id,v_user,'communications.chat.message.created','atlas_chat',v_message.id::text,
      jsonb_build_object('conversation_id',v_conversation_id,'sequence',v_message.sequence,'trace_id',v_message.trace_id,'actor_type','human'));

    return jsonb_build_object('ok',true,'message',to_jsonb(v_message));
  end if;

  if p_api = 'read' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    select last_read_sequence into v_previous_sequence
    from public.atlas_chat_participants
    where org_id=p_org_id and conversation_id=v_conversation_id and user_id=v_user
    for update;
    v_sequence := greatest(coalesce(v_previous_sequence,0),coalesce((p_payload->>'sequence')::bigint,0));
    update public.atlas_chat_participants
      set last_read_sequence=v_sequence
      where org_id=p_org_id and conversation_id=v_conversation_id and user_id=v_user;
    if v_sequence > coalesce(v_previous_sequence,0) then
      insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
      values (p_org_id,v_user,'communications.chat.conversation.read','atlas_chat',v_conversation_id::text,
        jsonb_build_object('previous_sequence',coalesce(v_previous_sequence,0),'last_read_sequence',v_sequence));
    end if;
    return jsonb_build_object('ok',true,'receipt',jsonb_build_object('conversation_id',v_conversation_id,'last_read_sequence',v_sequence));
  end if;

  if p_api = 'participant' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    v_target_user := nullif(p_payload->>'user_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    if not exists (
      select 1
      from public.atlas_chat_conversations c
      left join public.atlas_chat_participants cp
        on cp.conversation_id=c.id and cp.user_id=v_user
      where c.id=v_conversation_id and c.org_id=p_org_id
        and (c.created_by=v_user or v_role in ('owner','admin','platform_admin') or cp.participant_role in ('owner','moderator'))
    ) then
      raise exception 'chat_participant_manage_denied' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.organization_members
      where org_id=p_org_id and user_id=v_target_user and status='active'
    ) then
      raise exception 'chat_participant_outside_organization' using errcode = '42501';
    end if;
    insert into public.atlas_chat_participants(conversation_id,org_id,user_id,participant_role,left_at)
    values(v_conversation_id,p_org_id,v_target_user,'member',null)
    on conflict(conversation_id,user_id) do update set left_at=null;
    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
    values (p_org_id,v_user,'communications.chat.participant.added','atlas_chat',v_conversation_id::text,
      jsonb_build_object('user_id',v_target_user));
    return jsonb_build_object('ok',true,'participant',jsonb_build_object('conversation_id',v_conversation_id,'user_id',v_target_user));
  end if;

  if p_api = 'export' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
    values (p_org_id,v_user,'communications.chat.conversation.exported','atlas_chat',v_conversation_id::text,'{}'::jsonb);
    select jsonb_build_object(
      'schema','atlas.chat.export.v1',
      'exported_at',now(),
      'organization_id',p_org_id,
      'conversation',(select to_jsonb(c) from public.atlas_chat_conversations c where c.id=v_conversation_id and c.org_id=p_org_id),
      'participants',coalesce((select jsonb_agg(to_jsonb(cp) order by cp.joined_at) from public.atlas_chat_participants cp where cp.conversation_id=v_conversation_id and cp.org_id=p_org_id),'[]'::jsonb),
      'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.sequence) from public.atlas_chat_messages m where m.conversation_id=v_conversation_id and m.org_id=p_org_id),'[]'::jsonb),
      'attachments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.atlas_chat_attachments a where a.conversation_id=v_conversation_id and a.org_id=p_org_id),'[]'::jsonb)
    ) into v_result;
    return jsonb_build_object('ok',true,'export',v_result);
  end if;

  if p_api = 'deletion-request' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    select * into v_row
    from public.atlas_chat_deletion_requests
    where org_id=p_org_id and conversation_id=v_conversation_id and requested_by=v_user and status='pending'
    limit 1;
    if not found then
      insert into public.atlas_chat_deletion_requests(org_id,conversation_id,requested_by,reason,status)
      values(p_org_id,v_conversation_id,v_user,nullif(left(coalesce(p_payload->>'reason',''),1000),''),'pending')
      returning * into v_row;
      insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
      values (p_org_id,v_user,'communications.chat.deletion.requested','atlas_chat',v_row.id::text,
        jsonb_build_object('conversation_id',v_conversation_id));
    end if;
    return jsonb_build_object('ok',true,'deletion_request',to_jsonb(v_row));
  end if;

  if p_api = 'deletion-review' then
    if v_role not in ('owner','admin','platform_admin') then
      raise exception 'chat_deletion_review_role_required' using errcode = '42501';
    end if;
    v_message_id := nullif(p_payload->>'request_id','')::uuid;
    select * into v_row
    from public.atlas_chat_deletion_requests
    where id=v_message_id and org_id=p_org_id and status='pending'
    for update;
    if not found then
      raise exception 'chat_deletion_request_not_found' using errcode = 'P0002';
    end if;
    if coalesce(p_payload->>'decision','') = 'reject' then
      update public.atlas_chat_deletion_requests
      set status='rejected',reviewed_by=v_user,reviewed_at=now(),review_reason=left(p_payload->>'review_reason',1000),updated_at=now()
      where id=v_row.id returning * into v_row;
      insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
      values (p_org_id,v_user,'communications.chat.deletion.rejected','atlas_chat',v_row.id::text,
        jsonb_build_object('conversation_id',v_row.conversation_id));
      return jsonb_build_object('ok',true,'deletion_request',to_jsonb(v_row));
    end if;
    if coalesce(p_payload->>'decision','') <> 'approve' then
      raise exception 'chat_deletion_decision_invalid' using errcode = '22023';
    end if;
    if exists(select 1 from public.atlas_chat_conversations where id=v_row.conversation_id and org_id=p_org_id and legal_hold) then
      raise exception 'chat_legal_hold_active' using errcode = '55000';
    end if;
    insert into public.audit_logs(org_id,user_id,action,table_name,record_id,new_data)
    values (p_org_id,v_user,'communications.chat.deletion.approved','atlas_chat',v_row.id::text,
      jsonb_build_object('conversation_id',v_row.conversation_id));
    delete from public.atlas_chat_conversations where id=v_row.conversation_id and org_id=p_org_id;
    update public.atlas_chat_deletion_requests
    set status='completed',reviewed_by=v_user,reviewed_at=now(),review_reason=left(p_payload->>'review_reason',1000),updated_at=now()
    where id=v_row.id returning * into v_row;
    return jsonb_build_object('ok',true,'deletion_request',to_jsonb(v_row));
  end if;

  if p_api = 'authorize-realtime' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    return jsonb_build_object('ok',true,'realtime',jsonb_build_object(
      'org_id',p_org_id,'user_id',v_user,'conversation_id',v_conversation_id
    ));
  end if;

  if p_api = 'publish-authorize' then
    v_conversation_id := nullif(p_payload->>'conversation_id','')::uuid;
    v_message_id := nullif(p_payload->>'message_id','')::uuid;
    if not public.atlas_chat_can_access(p_org_id, v_conversation_id, v_user) then
      raise exception 'chat_access_denied' using errcode = '42501';
    end if;
    select sequence into v_sequence
    from public.atlas_chat_messages
    where id=v_message_id and org_id=p_org_id and conversation_id=v_conversation_id and sender_id=v_user;
    if v_sequence is null then
      raise exception 'chat_publish_denied' using errcode = '42501';
    end if;
    return jsonb_build_object('ok',true,'publish',jsonb_build_object(
      'org_id',p_org_id,'user_id',v_user,'conversation_id',v_conversation_id,'message_id',v_message_id,'sequence',v_sequence
    ));
  end if;

  raise exception 'chat_api_not_found' using errcode = '22023';
end;
$$;

revoke all on function public.atlas_chat_api(text,uuid,jsonb) from public, anon;
grant execute on function public.atlas_chat_api(text,uuid,jsonb) to authenticated, service_role;
