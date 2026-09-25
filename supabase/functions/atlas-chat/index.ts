import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = '2026-09-25.1';
const ADMIN_ROLES = new Set(['owner', 'admin', 'platform_admin']);
const CHANNELS = new Set(['direct', 'team', 'support', 'assistant', 'system']);
const CLASSIFICATIONS = new Set(['organization', 'restricted', 'confidential']);
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173'
]);

type ChatContext = {
  userId: string;
  orgId: string;
  role: string;
};

function fail(code: string, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
  return {
    ...(allowed ? { 'access-control-allow-origin': allowed } : {}),
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw fail('chat_runtime_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function boundedInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

async function requestBody(req: Request) {
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as Record<string, unknown>;
  } catch {
    throw fail('invalid_json', 400);
  }
}

async function context(req: Request): Promise<ChatContext> {
  if (!URL || !PUBLISHABLE) throw fail('supabase_runtime_not_configured', 503);
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw fail('authentication_required', 401);

  const sb = createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw fail('invalid_session', 401);

  const requestedOrg = text(req.headers.get('x-atlas-org-id'), 80);
  if (requestedOrg && !isUuid(requestedOrg)) throw fail('invalid_organization', 400);

  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active');

  if (membershipError || !memberships?.length) throw fail('active_organization_required', 403);
  const membership = requestedOrg
    ? memberships.find((row) => String(row.org_id) === requestedOrg)
    : memberships[0];
  if (!membership) throw fail('organization_membership_required', 403);

  return {
    userId: data.user.id,
    orgId: String(membership.org_id),
    role: String(membership.role || 'member')
  };
}

async function audit(ctx: ChatContext, action: string, recordId: string | null, metadata: Record<string, unknown>) {
  const { error } = await adminClient().from('audit_logs').insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action,
    table_name: 'atlas_chat',
    record_id: recordId,
    new_data: metadata
  });
  if (error) throw fail('chat_audit_write_failed', 500);
}

async function participant(ctx: ChatContext, conversationId: string) {
  if (!isUuid(conversationId)) throw fail('chat_conversation_id_required', 422);
  const { data, error } = await adminClient()
    .from('atlas_chat_participants')
    .select('conversation_id,org_id,user_id,participant_role,left_at,last_read_sequence')
    .eq('org_id', ctx.orgId)
    .eq('conversation_id', conversationId)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .maybeSingle();
  if (error) throw fail('chat_participant_read_failed', 500);
  if (!data) throw fail('chat_access_denied', 403);
  return data;
}

async function listMembers(ctx: ChatContext) {
  const sb = adminClient();
  const { data: memberships, error } = await sb
    .from('organization_members')
    .select('user_id,role,status')
    .eq('org_id', ctx.orgId)
    .eq('status', 'active')
    .limit(250);
  if (error) throw fail('chat_members_read_failed', 500);
  const ids = [...new Set((memberships || []).map((row) => String(row.user_id)).filter(isUuid))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await sb.from('profiles').select('id,full_name').in('id', ids);
    for (const profile of profiles || []) names.set(String(profile.id), text(profile.full_name, 160));
  }
  return (memberships || []).map((row) => ({
    user_id: String(row.user_id),
    role: String(row.role || 'member'),
    full_name: names.get(String(row.user_id)) || 'ATLAS member'
  }));
}

async function listConversations(ctx: ChatContext, url: URL) {
  const limit = Math.max(1, boundedInt(url.searchParams.get('limit'), 50, 100));
  const sb = adminClient();
  const { data: participation, error: participantError } = await sb
    .from('atlas_chat_participants')
    .select('conversation_id,last_read_sequence,participant_role')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .is('left_at', null)
    .limit(200);
  if (participantError) throw fail('chat_conversation_read_failed', 500);
  const ids = (participation || []).map((row) => String(row.conversation_id)).filter(isUuid);
  if (!ids.length) return [];

  const { data: conversations, error } = await sb
    .from('atlas_chat_conversations')
    .select('*')
    .eq('org_id', ctx.orgId)
    .in('id', ids)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw fail('chat_conversation_read_failed', 500);

  const readState = new Map((participation || []).map((row) => [String(row.conversation_id), row]));
  return (conversations || []).map((conversation) => ({
    ...conversation,
    last_read_sequence: Number(readState.get(String(conversation.id))?.last_read_sequence || 0),
    participant_role: String(readState.get(String(conversation.id))?.participant_role || 'member')
  }));
}

async function listMessages(ctx: ChatContext, url: URL) {
  const conversationId = text(url.searchParams.get('conversation_id'), 80);
  await participant(ctx, conversationId);
  const limit = Math.max(1, boundedInt(url.searchParams.get('limit'), 100, 200));
  const afterSequence = boundedInt(url.searchParams.get('after_sequence'), 0, Number.MAX_SAFE_INTEGER);
  let query = adminClient()
    .from('atlas_chat_messages')
    .select('id,org_id,conversation_id,sender_id,actor_type,client_message_id,sequence,content,reply_to_message_id,edited_at,deleted_at,created_at')
    .eq('org_id', ctx.orgId)
    .eq('conversation_id', conversationId)
    .gt('sequence', afterSequence)
    .order('sequence', { ascending: true })
    .limit(limit);
  const { data, error } = await query;
  if (error) throw fail('chat_message_read_failed', 500);
  return data || [];
}

async function createConversation(ctx: ChatContext, input: Record<string, unknown>) {
  const channel = text(input.channel || 'team', 40);
  const classification = text(input.classification || 'organization', 40);
  if (!CHANNELS.has(channel)) throw fail('chat_channel_invalid', 422);
  if (!CLASSIFICATIONS.has(classification)) throw fail('chat_classification_invalid', 422);

  const rawParticipants = Array.isArray(input.participant_user_ids) ? input.participant_user_ids : [];
  const participantIds = [...new Set(rawParticipants.map((value) => text(value, 80)).filter(isUuid))].slice(0, 50);
  const { data, error } = await adminClient().rpc('atlas_chat_create_conversation', {
    p_org_id: ctx.orgId,
    p_user_id: ctx.userId,
    p_title: text(input.title, 240),
    p_channel: channel,
    p_classification: classification,
    p_participant_user_ids: participantIds
  });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('outside_organization')) throw fail('chat_participant_outside_organization', 403);
    throw fail('chat_conversation_create_failed', 500);
  }
  const conversation = Array.isArray(data) ? data[0] : data;
  if (!conversation?.id) throw fail('chat_conversation_create_failed', 500);
  await audit(ctx, 'communications.chat.conversation.created', String(conversation.id), {
    channel,
    classification,
    participant_count: participantIds.length + (participantIds.includes(ctx.userId) ? 0 : 1)
  });
  return conversation;
}

async function sendMessage(ctx: ChatContext, input: Record<string, unknown>) {
  const conversationId = text(input.conversation_id, 80);
  const clientMessageId = text(input.client_message_id, 80);
  const messageText = text(input.text, 12000);
  if (!isUuid(conversationId)) throw fail('chat_conversation_id_required', 422);
  if (!isUuid(clientMessageId)) throw fail('chat_client_message_id_required', 422);
  if (!messageText) throw fail('chat_message_required', 422);

  const { data, error } = await adminClient().rpc('atlas_chat_append_message', {
    p_org_id: ctx.orgId,
    p_user_id: ctx.userId,
    p_conversation_id: conversationId,
    p_client_message_id: clientMessageId,
    p_content: { text: messageText },
    p_actor_type: 'human'
  });
  if (error) {
    const message = String(error.message || '');
    if (message.includes('chat_access_denied')) throw fail('chat_access_denied', 403);
    if (message.includes('chat_conversation_not_active')) throw fail('chat_conversation_not_active', 409);
    if (message.includes('chat_message_length_invalid')) throw fail('chat_message_length_invalid', 422);
    throw fail('chat_message_write_failed', 500);
  }
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.id) throw fail('chat_message_write_failed', 500);

  await audit(ctx, 'communications.chat.message.created', String(saved.id), {
    conversation_id: conversationId,
    sequence: Number(saved.sequence || 0),
    actor_type: 'human'
  });
  return saved;
}

async function markRead(ctx: ChatContext, input: Record<string, unknown>) {
  const conversationId = text(input.conversation_id, 80);
  const sequence = Math.max(0, Number(input.sequence || 0));
  const current = await participant(ctx, conversationId);
  const nextSequence = Math.max(Number(current.last_read_sequence || 0), Number.isFinite(sequence) ? sequence : 0);
  const { error } = await adminClient()
    .from('atlas_chat_participants')
    .update({ last_read_sequence: nextSequence })
    .eq('org_id', ctx.orgId)
    .eq('conversation_id', conversationId)
    .eq('user_id', ctx.userId);
  if (error) throw fail('chat_receipt_write_failed', 500);
  return { conversation_id: conversationId, last_read_sequence: nextSequence };
}

async function addParticipant(ctx: ChatContext, input: Record<string, unknown>) {
  const conversationId = text(input.conversation_id, 80);
  const userId = text(input.user_id, 80);
  if (!isUuid(userId)) throw fail('chat_participant_user_required', 422);
  const mine = await participant(ctx, conversationId);

  const { data: conversation, error: conversationError } = await adminClient()
    .from('atlas_chat_conversations')
    .select('id,created_by,status')
    .eq('org_id', ctx.orgId)
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError || !conversation) throw fail('chat_conversation_not_found', 404);
  const canManage = String(conversation.created_by) === ctx.userId
    || ADMIN_ROLES.has(ctx.role)
    || ['owner', 'moderator'].includes(String(mine.participant_role));
  if (!canManage) throw fail('chat_participant_manage_denied', 403);

  const { data: membership } = await adminClient()
    .from('organization_members')
    .select('user_id')
    .eq('org_id', ctx.orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) throw fail('chat_participant_outside_organization', 403);

  const { error } = await adminClient()
    .from('atlas_chat_participants')
    .upsert({
      conversation_id: conversationId,
      org_id: ctx.orgId,
      user_id: userId,
      participant_role: 'member',
      left_at: null
    }, { onConflict: 'conversation_id,user_id' });
  if (error) throw fail('chat_participant_write_failed', 500);
  await audit(ctx, 'communications.chat.participant.added', conversationId, { user_id: userId });
  return { conversation_id: conversationId, user_id: userId };
}

async function realtimeAuthorization(ctx: ChatContext, input: Record<string, unknown>) {
  const conversationId = text(input.conversation_id, 80);
  await participant(ctx, conversationId);
  return {
    org_id: ctx.orgId,
    user_id: ctx.userId,
    conversation_id: conversationId
  };
}

async function publishAuthorization(ctx: ChatContext, input: Record<string, unknown>) {
  const conversationId = text(input.conversation_id, 80);
  const messageId = text(input.message_id, 80);
  await participant(ctx, conversationId);
  if (!isUuid(messageId)) throw fail('chat_message_id_required', 422);

  const { data, error } = await adminClient()
    .from('atlas_chat_messages')
    .select('id,conversation_id,sender_id,sequence')
    .eq('org_id', ctx.orgId)
    .eq('conversation_id', conversationId)
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw fail('chat_message_read_failed', 500);
  if (!data || String(data.sender_id) !== ctx.userId) throw fail('chat_publish_denied', 403);

  return {
    org_id: ctx.orgId,
    user_id: ctx.userId,
    conversation_id: conversationId,
    message_id: String(data.id),
    sequence: Number(data.sequence || 0)
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

  const url = new URL(req.url);
  const api = text(url.searchParams.get('api'), 80);

  try {
    const ctx = await context(req);

    if (req.method === 'GET' && api === 'readiness') {
      return json({
        ok: true,
        service: 'atlas-chat',
        version: VERSION,
        authenticated: true,
        organization_id: ctx.orgId,
        user_id: ctx.userId,
        realtime: { transport: 'cloudflare-durable-object', fallback: 'polling' },
        attachments: { schema_ready: true, upload_enabled: false, reason: 'malware_scan_not_configured' }
      }, 200, origin);
    }

    if (req.method === 'GET' && api === 'members') {
      return json({ ok: true, members: await listMembers(ctx) }, 200, origin);
    }

    if (req.method === 'GET' && api === 'conversations') {
      return json({ ok: true, conversations: await listConversations(ctx, url) }, 200, origin);
    }

    if (req.method === 'GET' && api === 'messages') {
      return json({ ok: true, messages: await listMessages(ctx, url) }, 200, origin);
    }

    if (req.method === 'POST' && api === 'conversation') {
      return json({ ok: true, conversation: await createConversation(ctx, await requestBody(req)) }, 201, origin);
    }

    if (req.method === 'POST' && api === 'message') {
      return json({ ok: true, message: await sendMessage(ctx, await requestBody(req)) }, 201, origin);
    }

    if (req.method === 'POST' && api === 'read') {
      return json({ ok: true, receipt: await markRead(ctx, await requestBody(req)) }, 200, origin);
    }

    if (req.method === 'POST' && api === 'participant') {
      return json({ ok: true, participant: await addParticipant(ctx, await requestBody(req)) }, 200, origin);
    }

    if (req.method === 'POST' && api === 'authorize-realtime') {
      return json({ ok: true, realtime: await realtimeAuthorization(ctx, await requestBody(req)) }, 200, origin);
    }

    if (req.method === 'POST' && api === 'publish-authorize') {
      return json({ ok: true, publish: await publishAuthorization(ctx, await requestBody(req)) }, 200, origin);
    }

    return json({ ok: false, error: 'not_found' }, 404, origin);
  } catch (cause) {
    const error = cause as Error & { code?: string; status?: number };
    return json({
      ok: false,
      error: error.code || error.message || 'chat_internal_error'
    }, Number(error.status || 500), origin);
  }
});
