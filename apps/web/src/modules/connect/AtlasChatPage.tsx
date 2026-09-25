import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  connectChatRealtime,
  createChatConversation,
  getChatReadiness,
  listChatConversations,
  listChatMembers,
  listChatMessages,
  markChatRead,
  publishChatRealtime,
  sendChatMessage,
  type AtlasChatConversation,
  type AtlasChatMember,
  type AtlasChatMessage,
  type AtlasChatReadiness
} from './chatApi';
import './atlas-chat.css';

type RealtimeState = 'connecting' | 'live' | 'polling';

function messageText(message: AtlasChatMessage) {
  return typeof message.content?.text === 'string' ? message.content.text : '';
}

function timeLabel(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function humanizeError(value: string) {
  const map: Record<string, string> = {
    authentication_required: 'Your ATLAS session is required to use Chat.',
    session_expired: 'Your ATLAS session expired. Sign in again to continue.',
    active_organization_required: 'ATLAS could not resolve an active organization.',
    organization_membership_required: 'Your account is not authorized for this organization.',
    chat_access_denied: 'You do not have access to this conversation.',
    chat_participant_outside_organization: 'Every participant must belong to the active organization.',
    chat_conversation_not_active: 'This conversation is no longer active.',
    chat_message_length_invalid: 'Messages must contain between 1 and 12,000 characters.',
    chat_runtime_not_configured: 'ATLAS Chat runtime is not configured.',
    chat_request_failed: 'ATLAS Chat could not complete the request.'
  };
  return map[value] || value.replaceAll('_', ' ');
}

export function AtlasChatPage() {
  const [readiness, setReadiness] = useState<AtlasChatReadiness | null>(null);
  const [members, setMembers] = useState<AtlasChatMember[]>([]);
  const [conversations, setConversations] = useState<AtlasChatConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AtlasChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('polling');
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState<AtlasChatConversation['channel']>('team');
  const [newClassification, setNewClassification] = useState<AtlasChatConversation['classification']>('organization');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) || null,
    [conversationId, conversations]
  );

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.full_name])),
    [members]
  );

  const otherMembers = useMemo(
    () => members.filter((member) => member.user_id !== readiness?.user_id),
    [members, readiness?.user_id]
  );

  const refreshConversations = useCallback(async () => {
    const next = await listChatConversations();
    setConversations(next);
    setConversationId((current) => {
      if (current && next.some((conversation) => conversation.id === current)) return current;
      return next[0]?.id || null;
    });
    return next;
  }, []);

  const refreshMessages = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setThreadLoading(true);
    try {
      const next = await listChatMessages(id);
      setMessages(next);
      const lastSequence = next.at(-1)?.sequence || 0;
      if (lastSequence > 0) {
        markChatRead(id, lastSequence).catch(() => undefined);
      }
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : 'chat_request_failed');
    } finally {
      if (!quiet) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getChatReadiness(), listChatMembers(), listChatConversations()])
      .then(([nextReadiness, nextMembers, nextConversations]) => {
        if (!active) return;
        setReadiness(nextReadiness);
        setMembers(nextMembers);
        setConversations(nextConversations);
        setConversationId(nextConversations[0]?.id || null);
        setError('');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'chat_request_failed');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let disposed = false;
    let closeRealtime: () => void = () => {};
    setRealtimeState('connecting');
    refreshMessages(conversationId).catch(() => undefined);

    connectChatRealtime(conversationId, {
      onState: (state) => {
        if (!disposed) setRealtimeState(state);
      },
      onMessage: (event) => {
        if (!disposed && event.event === 'chat.message' && event.conversation_id === conversationId) {
          refreshMessages(conversationId, true).catch(() => undefined);
          refreshConversations().catch(() => undefined);
        }
      }
    })
      .then((close) => {
        if (disposed) close();
        else closeRealtime = close;
      })
      .catch(() => {
        if (!disposed) setRealtimeState('polling');
      });

    const polling = window.setInterval(() => {
      if (!disposed) refreshMessages(conversationId, true).catch(() => undefined);
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(polling);
      closeRealtime();
    };
  }, [conversationId, refreshMessages, refreshConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, sending]);

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!conversationId || !text || sending) return;
    setSending(true);
    setError('');
    try {
      const saved = await sendChatMessage({
        conversationId,
        text,
        clientMessageId: crypto.randomUUID()
      });
      setMessage('');
      setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved]);
      refreshConversations().catch(() => undefined);
      publishChatRealtime(conversationId, saved.id)
        .then(() => setRealtimeState('live'))
        .catch(() => setRealtimeState('polling'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'chat_request_failed');
    } finally {
      setSending(false);
    }
  }

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const conversation = await createChatConversation({
        title: newTitle.trim(),
        channel: newChannel,
        classification: newClassification,
        participantUserIds: selectedMembers
      });
      await refreshConversations();
      setConversationId(conversation.id);
      setNewOpen(false);
      setNewTitle('');
      setSelectedMembers([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'chat_request_failed');
    } finally {
      setCreating(false);
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  if (loading) {
    return <section className="atlas-chat-page"><div className="atlas-chat-state">Loading ATLAS Chat…</div></section>;
  }

  return (
    <section className="atlas-chat-page" aria-labelledby="atlas-chat-title">
      <header className="atlas-chat-header">
        <div>
          <p className="eyebrow">Communications · Governed realtime</p>
          <h1 id="atlas-chat-title">ATLAS Chat</h1>
          <p>Organization-scoped messaging with durable history, ordered delivery, RBAC and audit evidence.</p>
        </div>
        <div className={'atlas-chat-live ' + realtimeState} aria-live="polite">
          <span aria-hidden="true" />
          {realtimeState === 'live' ? 'Realtime live' : realtimeState === 'connecting' ? 'Connecting…' : 'Polling fallback'}
        </div>
      </header>

      {error ? (
        <div className="atlas-chat-error" role="alert">
          {humanizeError(error)}
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      ) : null}

      <div className="atlas-chat-shell">
        <aside className="atlas-chat-sidebar" aria-label="Conversations">
          <div className="atlas-chat-sidebar-head">
            <div>
              <span>Workspace</span>
              <strong>Conversations</strong>
            </div>
            <button type="button" className="atlas-chat-primary" onClick={() => setNewOpen((value) => !value)}>
              {newOpen ? 'Cancel' : '+ New'}
            </button>
          </div>

          {newOpen ? (
            <form className="atlas-chat-create" onSubmit={createConversation}>
              <label>
                Conversation name
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  maxLength={240}
                  placeholder="e.g. September close"
                />
              </label>
              <div className="atlas-chat-create-row">
                <label>
                  Channel
                  <select value={newChannel} onChange={(event) => setNewChannel(event.target.value as AtlasChatConversation['channel'])}>
                    <option value="team">Team</option>
                    <option value="direct">Direct</option>
                    <option value="support">Support</option>
                  </select>
                </label>
                <label>
                  Classification
                  <select
                    value={newClassification}
                    onChange={(event) => setNewClassification(event.target.value as AtlasChatConversation['classification'])}
                  >
                    <option value="organization">Organization</option>
                    <option value="restricted">Restricted</option>
                    <option value="confidential">Confidential</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>Participants</legend>
                <div className="atlas-chat-member-picker">
                  {otherMembers.length ? otherMembers.map((member) => (
                    <label key={member.user_id}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.user_id)}
                        onChange={() => toggleMember(member.user_id)}
                      />
                      <span>{member.full_name}</span>
                      <small>{member.role}</small>
                    </label>
                  )) : <p>No additional active organization members are available.</p>}
                </div>
              </fieldset>
              <button type="submit" className="atlas-chat-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create conversation'}
              </button>
            </form>
          ) : null}

          <div className="atlas-chat-conversations">
            {conversations.length ? conversations.map((conversation) => {
              const unread = Math.max(0, Number(conversation.last_sequence || 0) - Number(conversation.last_read_sequence || 0));
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={conversation.id === conversationId ? 'active' : ''}
                  onClick={() => {
                    setConversationId(conversation.id);
                    setError('');
                  }}
                >
                  <span className="atlas-chat-conversation-top">
                    <strong>{conversation.title || 'Untitled conversation'}</strong>
                    {unread > 0 ? <b>{unread > 99 ? '99+' : unread}</b> : null}
                  </span>
                  <span className="atlas-chat-conversation-meta">
                    {conversation.channel} · {conversation.classification}
                  </span>
                  <time>{timeLabel(conversation.last_message_at || conversation.updated_at)}</time>
                </button>
              );
            }) : (
              <div className="atlas-chat-empty-small">
                <strong>No conversations yet</strong>
                <span>Create the first organization-scoped thread.</span>
              </div>
            )}
          </div>
        </aside>

        <main className="atlas-chat-thread">
          {currentConversation ? (
            <>
              <header className="atlas-chat-thread-head">
                <div>
                  <span>{currentConversation.channel} · {currentConversation.classification}</span>
                  <h2>{currentConversation.title || 'Untitled conversation'}</h2>
                </div>
                <div className="atlas-chat-thread-flags">
                  {currentConversation.legal_hold ? <span>Legal hold</span> : null}
                  <span>{currentConversation.status}</span>
                </div>
              </header>

              <div className="atlas-chat-messages" aria-live="polite" aria-busy={threadLoading}>
                {threadLoading && !messages.length ? <div className="atlas-chat-state">Loading messages…</div> : null}
                {!threadLoading && !messages.length ? (
                  <div className="atlas-chat-empty-thread">
                    <strong>Start the conversation</strong>
                    <span>Messages are persisted before realtime notification is emitted.</span>
                  </div>
                ) : null}
                {messages.map((item) => {
                  const mine = item.sender_id === readiness?.user_id;
                  const sender = item.sender_id
                    ? memberNames.get(item.sender_id) || (mine ? 'You' : 'ATLAS member')
                    : item.actor_type === 'assistant' ? 'ATLAS Assistant' : 'ATLAS System';
                  return (
                    <article key={item.id} className={'atlas-chat-message ' + (mine ? 'mine' : 'theirs')}>
                      <div className="atlas-chat-message-meta">
                        <strong>{mine ? 'You' : sender}</strong>
                        <span>#{item.sequence}</span>
                        <time dateTime={item.created_at}>{timeLabel(item.created_at)}</time>
                      </div>
                      <p>{item.deleted_at ? 'Message removed' : messageText(item)}</p>
                      {item.edited_at ? <small>Edited</small> : null}
                    </article>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form className="atlas-chat-composer" onSubmit={submitMessage}>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={12000}
                  rows={3}
                  placeholder={currentConversation.status === 'active' ? 'Message ATLAS Chat…' : 'Conversation is not active'}
                  disabled={sending || currentConversation.status !== 'active'}
                  aria-label="Message"
                />
                <div className="atlas-chat-composer-actions">
                  <div>
                    <span>{message.length.toLocaleString()} / 12,000</span>
                    <span className="atlas-chat-attachment-gate" title={readiness?.attachments.reason || 'Attachment gate'}>
                      Attachments: {readiness?.attachments.upload_enabled ? 'enabled' : 'security gate pending'}
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="atlas-chat-primary"
                    disabled={sending || !message.trim() || currentConversation.status !== 'active'}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="atlas-chat-no-selection">
              <strong>ATLAS Chat is ready.</strong>
              <span>Create or select a conversation to begin.</span>
            </div>
          )}
        </main>
      </div>

      <footer className="atlas-chat-footer">
        <span>Durable source of truth: Supabase · Realtime hints: Cloudflare Durable Objects</span>
        <span>Attachments remain fail-closed until malware scanning is configured.</span>
      </footer>
    </section>
  );
}
