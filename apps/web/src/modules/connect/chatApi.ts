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
  realtime: { transport: string; fallback: string };
  attachments: { schema_ready: boolean; upload_enabled: boolean; reason: string | null };
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
  content: { text?: string; [key: string]: unknown };
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

async function callChatRpc<T>(api: string, payload: Record<string, unknown> = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/atlas_chat_api', {
    method: 'POST',
    body: JSON.stringify({
      p_api: api,
      p_org_id: organization.id,
      p_payload: payload
    })
  });
  return parse<T>(response);
}

export function getChatReadiness(): Promise<AtlasChatReadiness> {
  return callChatRpc<AtlasChatReadiness>('readiness');
}

export async function listChatMembers(): Promise<AtlasChatMember[]> {
  const payload = await callChatRpc<{ ok: boolean; members?: AtlasChatMember[] }>('members');
  return Array.isArray(payload.members) ? payload.members : [];
}

export async function listChatConversations(): Promise<AtlasChatConversation[]> {
  const payload = await callChatRpc<{ ok: boolean; conversations?: AtlasChatConversation[] }>('conversations');
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function listChatMessages(
  conversationId: string,
  afterSequence = 0
): Promise<AtlasChatMessage[]> {
  const payload = await callChatRpc<{ ok: boolean; messages?: AtlasChatMessage[] }>('messages', {
    conversation_id: conversationId,
    after_sequence: Math.max(0, afterSequence)
  });
  return Array.isArray(payload.messages) ? payload.messages : [];
}

export async function createChatConversation(input: {
  title: string;
  channel: AtlasChatConversation['channel'];
  classification: AtlasChatConversation['classification'];
  participantUserIds: string[];
}): Promise<AtlasChatConversation> {
  const payload = await callChatRpc<{ ok: boolean; conversation: AtlasChatConversation }>('conversation', {
    title: input.title,
    channel: input.channel,
    classification: input.classification,
    participant_user_ids: input.participantUserIds
  });
  return payload.conversation;
}

export async function sendChatMessage(input: {
  conversationId: string;
  text: string;
  clientMessageId: string;
}): Promise<AtlasChatMessage> {
  const payload = await callChatRpc<{ ok: boolean; message: AtlasChatMessage }>('message', {
    conversation_id: input.conversationId,
    text: input.text,
    client_message_id: input.clientMessageId
  });
  return payload.message;
}

export function markChatRead(conversationId: string, sequence: number) {
  return callChatRpc<{ ok: boolean; receipt: { conversation_id: string; last_read_sequence: number } }>('read', {
    conversation_id: conversationId,
    sequence
  });
}

export function addChatParticipant(conversationId: string, userId: string) {
  return callChatRpc<{ ok: boolean; participant: { conversation_id: string; user_id: string } }>('participant', {
    conversation_id: conversationId,
    user_id: userId
  });
}

export async function exportChatConversation(conversationId: string) {
  const payload = await callChatRpc<{ ok: boolean; export: Record<string, unknown> }>('export', {
    conversation_id: conversationId
  });
  return payload.export;
}

export async function requestChatDeletion(conversationId: string, reason = '') {
  const payload = await callChatRpc<{
    ok: boolean;
    deletion_request: { id: string; status: string; created_at: string };
  }>('deletion-request', {
    conversation_id: conversationId,
    reason
  });
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
      // Ignore malformed realtime hints. Persistent Postgres state is authoritative.
    }
  });
  const fallback = () => {
    if (!closed) handlers.onState?.('polling');
  };
  socket.addEventListener('close', fallback);
  socket.addEventListener('error', fallback);

  return () => {
    closed = true;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'view_closed');
    }
  };
}
