import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  connectChatRealtime,
  createChatConversation,
  exportChatConversation,
  getChatReadiness,
  listChatConversations,
  listChatMembers,
  listChatMessages,
  markChatRead,
  publishChatRealtime,
  requestChatDeletion,
  sendChatMessage,
  type AtlasChatConversation,
  type AtlasChatMember,
  type AtlasChatMessage,
  type AtlasChatReadiness
} from './chatApi';
import './atlas-chat.css';

type RealtimeState = 'connecting' | 'live' | 'polling';
type ConversationDateField = 'activity' | 'created';
type ConversationDatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
type ConversationSort = 'newest' | 'oldest';
type ConversationFilterSettings = {
  dateField: ConversationDateField;
  datePreset: ConversationDatePreset;
  dateFrom: string;
  dateTo: string;
  conversationSort: ConversationSort;
};

const CHAT_FILTER_STORAGE_KEY = 'atlas.chat.conversationFilters.v1';

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

function toLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function conversationDateValue(conversation: AtlasChatConversation, field: ConversationDateField) {
  return field === 'created'
    ? conversation.created_at
    : conversation.last_message_at || conversation.updated_at;
}

function conversationDateBounds(preset: ConversationDatePreset, dateFrom: string, dateTo: string) {
  const now = new Date();
  let from: Date | null = null;
  let to: Date | null = null;

  if (preset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (preset === '7d' || preset === '30d') {
    const days = preset === '7d' ? 7 : 30;
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (preset === 'custom') {
    from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    to = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
    if (to) to = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  }

  return { from, to };
}

function loadConversationFilterSettings(): ConversationFilterSettings {
  const fallback: ConversationFilterSettings = {
    dateField: 'activity',
    datePreset: 'all',
    dateFrom: '',
    dateTo: '',
    conversationSort: 'newest'
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(CHAT_FILTER_STORAGE_KEY) || '{}');
    return {
      dateField: stored.dateField === 'created' ? 'created' : 'activity',
      datePreset: ['all', 'today', '7d', '30d', 'custom'].includes(stored.datePreset)
        ? stored.datePreset
        : 'all',
      dateFrom: typeof stored.dateFrom === 'string' ? stored.dateFrom : '',
      dateTo: typeof stored.dateTo === 'string' ? stored.dateTo : '',
      conversationSort: stored.conversationSort === 'oldest' ? 'oldest' : 'newest'
    };
  } catch {
    return fallback;
  }
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
  const initialFilters = useMemo(() => loadConversationFilterSettings(), []);
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
  const [privacyStatus, setPrivacyStatus] = useState('');
  const [dateField, setDateField] = useState<ConversationDateField>(initialFilters.dateField);
  const [datePreset, setDatePreset] = useState<ConversationDatePreset>(initialFilters.datePreset);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [conversationSort, setConversationSort] = useState<ConversationSort>(initialFilters.conversationSort);
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

  const filteredConversations = useMemo(() => {
    const { from, to } = conversationDateBounds(datePreset, dateFrom, dateTo);

    return conversations
      .filter((conversation) => {
        const raw = conversationDateValue(conversation, dateField);
        const value = new Date(raw);
        if (Number.isNaN(value.getTime())) return false;
        if (from && value < from) return false;
        if (to && value >= to) return false;
        return true;
      })
      .sort((a, b) => {
        const aValue = new Date(conversationDateValue(a, dateField)).getTime();
        const bValue = new Date(conversationDateValue(b, dateField)).getTime();
        return conversationSort === 'newest' ? bValue - aValue : aValue - bValue;
      });
  }, [conversations, dateField, dateFrom, datePreset, dateTo, conversationSort]);

  const filterActive = datePreset !== 'all' || dateField !== 'activity' || conversationSort !== 'newest';

  useEffect(() => {
    setConversationId((current) => {
      if (!filteredConversations.length) return null;
      if (current && filteredConversations.some((conversation) => conversation.id === current)) return current;
      return filteredConversations[0].id;
    });
  }, [filteredConversations]);

  function applyPreset(next: ConversationDatePreset) {
    setDatePreset(next);
    if (next === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (next === 'today') {
      const today = toLocalDateInput(new Date());
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (next === '7d' || next === '30d') {
      const now = new Date();
      const days = next === '7d' ? 7 : 30;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
      setDateFrom(toLocalDateInput(start));
      setDateTo(toLocalDateInput(now));
    }
  }

  function clearConversationFilters() {
    setDateField('activity');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setConversationSort('newest');
  }

  const refreshConversations = useCallback(async () => {
    const { from, to } = conversationDateBounds(datePreset, dateFrom, dateTo);
    const next = await listChatConversations({
      dateField,
      from: from?.toISOString() || null,
      to: to?.toISOString() || null,
      sort: conversationSort,
      limit: 2000
    });
    setConversations(next);
    setConversationId((current) => {
      if (current && next.some((conversation) => conversation.id === current)) return current;
      return next[0]?.id || null;
    });
    return next;
  }, [conversationSort, dateField, dateFrom, datePreset, dateTo]);

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
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CHAT_FILTER_STORAGE_KEY, JSON.stringify({
          dateField,
          datePreset,
          dateFrom,
          dateTo,
          conversationSort
        }));
      } catch {
        // Filter persistence is optional; chat functionality must remain available.
      }
    }
    if (!loading) {
      refreshConversations().catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'chat_request_failed');
      });
    }
  }, [conversationSort, dateField, dateFrom, datePreset, dateTo, loading, refreshConversations]);

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

  async function exportCurrentConversation() {
    if (!conversationId) return;
    setError('');
    setPrivacyStatus('Preparing export…');
    try {
      const data = await exportChatConversation(conversationId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `atlas-chat-${conversationId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPrivacyStatus('Export ready.');
    } catch (cause) {
      setPrivacyStatus('');
      setError(cause instanceof Error ? cause.message : 'chat_export_failed');
    }
  }

  async function requestCurrentConversationDeletion() {
    if (!conversationId || currentConversation?.legal_hold) return;
    setError('');
    setPrivacyStatus('Submitting deletion request…');
    try {
      const request = await requestChatDeletion(conversationId);
      setPrivacyStatus(`Deletion request ${request.status}.`);
    } catch (cause) {
      setPrivacyStatus('');
      setError(cause instanceof Error ? cause.message : 'chat_deletion_request_failed');
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

          <div className="atlas-chat-filters" aria-label="Conversation date filters">
            <div className="atlas-chat-filter-pills" role="group" aria-label="Quick date filters">
              {([
                ['all', 'All'],
                ['today', 'Today'],
                ['7d', '7 days'],
                ['30d', '30 days'],
                ['custom', 'Custom']
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={datePreset === value ? 'active' : ''}
                  onClick={() => applyPreset(value)}
                  aria-pressed={datePreset === value}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="atlas-chat-filter-grid">
              <label>
                Date basis
                <select value={dateField} onChange={(event) => setDateField(event.target.value as ConversationDateField)}>
                  <option value="activity">Last activity</option>
                  <option value="created">Created</option>
                </select>
              </label>
              <label>
                Sort
                <select value={conversationSort} onChange={(event) => setConversationSort(event.target.value as ConversationSort)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>

            {datePreset === 'custom' ? (
              <div className="atlas-chat-filter-grid">
                <label>
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            <div className="atlas-chat-filter-summary" aria-live="polite">
              <span>{filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}</span>
              {filterActive ? <button type="button" onClick={clearConversationFilters}>Reset</button> : null}
            </div>
          </div>

          <div className="atlas-chat-conversations">
            {filteredConversations.length ? filteredConversations.map((conversation) => {
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
                <strong>{conversations.length ? 'No conversations match this filter' : 'No conversations yet'}</strong>
                <span>{conversations.length ? 'Adjust the date criteria or reset the filter.' : 'Create the first organization-scoped thread.'}</span>
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
                <div className="atlas-chat-thread-actions">
                  <div className="atlas-chat-thread-flags">
                    {currentConversation.legal_hold ? <span>Legal hold</span> : null}
                    <span>{currentConversation.status}</span>
                  </div>
                  <div className="atlas-chat-privacy-actions">
                    <button type="button" onClick={exportCurrentConversation}>Export JSON</button>
                    <button
                      type="button"
                      onClick={requestCurrentConversationDeletion}
                      disabled={currentConversation.legal_hold}
                      title={currentConversation.legal_hold ? 'Deletion is blocked by legal hold.' : 'Request governed deletion review'}
                    >
                      Request deletion
                    </button>
                  </div>
                  {privacyStatus ? <small aria-live="polite">{privacyStatus}</small> : null}
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
