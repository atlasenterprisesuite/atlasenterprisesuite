import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization,
  getAtlasAccessToken
} from '../../lib/atlasSession';

export type AtlasChatReadiness = {
  ok: boolean;
  service: string;
  version: string;
  authenticated: boolean;
  organization_id: string;
  user_id?: string;
  realtime: {
    transport: string;
    fallback: string;
  };
  attachments: {
    schema_ready: boolean;
    upload_enabled: boolean;
    reason: string | null;
  };
  privacy?: {
    export_enabled: boolean;
    deletion_request_enabled: boolean;
    legal_hold_enforced: boolean;
  };
};

export type AtlasChatMember = {
  user_id: string;
  role: string;
  full_name: string;
};

export type AtlasChatConversation = {
  id: string;
  org_id: string;
  created_by: string;
  title: string | null;
  channel: 'direct' | 'team' | 'support' | 'assistant' | 'system';
  status: 'active' | 'closed' | 'archived';
  classification: 'organization' | 'restricted' | 'confidential';
  legal_hold: boolean;
  last_sequence: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_read_sequence: number;
  participant_role: 'member' | 'agent' | 'moderator' | 'owner';
};

export type AtlasChatMessage = {
  id: string;
  org_id: string;
  conversation_id: string;
  sender_id: string | null;
  actor_type: 'human' | 'assistant' | 'agent' | 'automation' | 'system' | 'external';
  client_message_id: string;
  sequence: number;
  trace_id?: string;
  content: {
    text?: string;
    [key: string]: unknown;
  };
  reply_to_message_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

async function parse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { error: raw || 'invalid_response' };
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || payload?.message || `chat_request_failed_${response.status}`));
  }
  return payload as T;
}

async function chatContext() {
  const organization = await getActiveAtlasOrganization();
  return {
    organization,
    headers: { 'x-atlas-org-id': organization.id }
  };
}

export async function getChatReadiness(): Promise<AtlasChatReadiness> {
  const { headers } = await chatContext();
  return parse<AtlasChatReadiness>(await authorizedAtlasFetch('/functions/v1/atlas-chat?api=readiness', {
    method: 'GET',
    headers
  }));
}

export async function listChatMembers(): Promise<AtlasChatMember[]> {
  const { headers } = await chatContext();
  const payload = await parse<{ ok: boolean; members?: AtlasChatMember[] }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=members', { method: 'GET', headers })
  );
  return Array.isArray(payload.members) ? payload.members : [];
}

export async function listChatConversations(): Promise<AtlasChatConversation[]> {
  const { headers } = await chatContext();
  const payload = await parse<{ ok: boolean; conversations?: AtlasChatConversation[] }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=conversations', { method: 'GET', headers })
  );
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function listChatMessages(
  conversationId: string,
  afterSequence = 0
): Promise<AtlasChatMessage[]> {
  const { headers } = await chatContext();
  const query = new URLSearchParams({
    api: 'messages',
    conversation_id: conversationId,
    after_sequence: String(Math.max(0, afterSequence))
  });
  const payload = await parse<{ ok: boolean; messages?: AtlasChatMessage[] }>(
    await authorizedAtlasFetch(`/functions/v1/atlas-chat?${query.toString()}`, { method: 'GET', headers })
  );
  return Array.isArray(payload.messages) ? payload.messages : [];
}

export async function createChatConversation(input: {
  title: string;
  channel: AtlasChatConversation['channel'];
  classification: AtlasChatConversation['classification'];
  participantUserIds: string[];
}): Promise<AtlasChatConversation> {
  const { headers } = await chatContext();
  const payload = await parse<{ ok: boolean; conversation: AtlasChatConversation }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=conversation', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: input.title,
        channel: input.channel,
        classification: input.classification,
        participant_user_ids: input.participantUserIds
      })
    })
  );
  return payload.conversation;
}

export async function sendChatMessage(input: {
  conversationId: string;
  text: string;
  clientMessageId: string;
}): Promise<AtlasChatMessage> {
  const { headers } = await chatContext();
  const payload = await parse<{ ok: boolean; message: AtlasChatMessage }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=message', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversation_id: input.conversationId,
        text: input.text,
        client_message_id: input.clientMessageId
      })
    })
  );
  return payload.message;
}

export async function markChatRead(conversationId: string, sequence: number) {
  const { headers } = await chatContext();
  return parse<{ ok: boolean; receipt: { conversation_id: string; last_read_sequence: number } }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, sequence })
    })
  );
}

export async function addChatParticipant(conversationId: string, userId: string) {
  const { headers } = await chatContext();
  return parse<{ ok: boolean; participant: { conversation_id: string; user_id: string } }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=participant', {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, user_id: userId })
    })
  );
}

export async function exportChatConversation(conversationId: string) {
  const { headers } = await chatContext();
  const query = new URLSearchParams({ api: 'export', conversation_id: conversationId });
  const payload = await parse<{ ok: boolean; export: Record<string, unknown> }>(
    await authorizedAtlasFetch(`/functions/v1/atlas-chat?${query.toString()}`, {
      method: 'GET',
      headers
    })
  );
  return payload.export;
}

export async function requestChatDeletion(conversationId: string, reason = '') {
  const { headers } = await chatContext();
  const payload = await parse<{ ok: boolean; deletion_request: { id: string; status: string; created_at: string } }>(
    await authorizedAtlasFetch('/functions/v1/atlas-chat?api=deletion-request', {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, reason })
    })
  );
  return payload.deletion_request;
}

async function workerContext() {
  const organization = await getActiveAtlasOrganization();
  const token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');
  return {
    organization,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-atlas-org-id': organization.id
    }
  };
}

export async function publishChatRealtime(conversationId: string, messageId: string) {
  const { headers } = await workerContext();
  return parse<{ ok: boolean; delivered: number; sequence: number }>(
    await fetch('/_atlas/chat/publish', {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId })
    })
  );
}

export async function connectChatRealtime(
  conversationId: string,
  handlers: {
    onMessage: (event: { event: string; conversation_id?: string; message_id?: string; sequence?: number }) => void;
    onState?: (state: 'connecting' | 'live' | 'polling') => void;
  }
): Promise<() => void> {
  handlers.onState?.('connecting');
  const { organization, headers } = await workerContext();
  const ticketPayload = await parse<{ ok: boolean; ticket: string; org_id: string; conversation_id: string }>(
    await fetch('/_atlas/chat/ticket', {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId })
    })
  );

  const socketUrl = new URL('/_atlas/chat/connect', window.location.origin);
  socketUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.searchParams.set('org_id', organization.id);
  socketUrl.searchParams.set('conversation_id', conversationId);
  socketUrl.searchParams.set('ticket', ticketPayload.ticket);

  const socket = new WebSocket(socketUrl);
  let closed = false;
  socket.addEventListener('open', () => handlers.onState?.('live'));
  socket.addEventListener('message', (message) => {
    if (typeof message.data !== 'string' || message.data === 'pong') return;
    try {
      const payload = JSON.parse(message.data);
      if (payload && typeof payload === 'object') handlers.onMessage(payload);
    } catch {
      // Ignore malformed realtime hints. The database/polling path remains authoritative.
    }
  });
  const fallback = () => {
    if (!closed) handlers.onState?.('polling');
  };
  socket.addEventListener('close', fallback);
  socket.addEventListener('error', fallback);

  return () => {
    closed = true;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(1000, 'view_closed');
  };
}
