import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssistantConversation,
  getAssistantStatus,
  listAssistantConversations,
  sendAssistantWorkspaceMessage,
  type AssistantConversation,
  type AssistantMode,
  type AssistantProfile,
  type AssistantProviderReadiness,
  type AssistantStatusResponse,
  type AssistantStoredMessage
} from '../../assistant/client';
import './UnifiedAIChat.css';

type DisplayMessage = {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
};

const MODES: Array<{ value: AssistantMode; label: string }> = [
  { value: 'auto', label: 'Auto · $0 first' },
  { value: 'atlas-local', label: 'ATLAS Local · $0 API' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'bedrock', label: 'OpenAI on AWS Bedrock' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'codex-sovereign', label: 'Codex Sovereign' },
  { value: 'council', label: 'Council' }
];

const PROFILES: Array<{ value: AssistantProfile; label: string }> = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'deep', label: 'Deep' }
];

const PROMPT_STARTERS = [
  'Summarize what changed across this organization today.',
  'Find the most relevant information across connected ATLAS sources and cite it.',
  'Create a governed work plan for this request and identify approvals before execution.',
  'Review this request for security, cost, permissions and execution risk.'
] as const;

const ENTERPRISE_LINKS = [
  { to: '/work', label: 'Work', description: 'Long-running governed execution' },
  { to: '/automations', label: 'Agents', description: 'Repeatable workflows and automation' },
  { to: '/work/connections', label: 'Apps', description: 'Connected tools and runtimes' },
  { to: '/work/team', label: 'Team', description: 'Members, roles and delegations' },
  { to: '/work/policies', label: 'Policies', description: 'Autonomy, approval and budget controls' },
  { to: '/suite', label: 'Modules', description: 'ATLAS enterprise application catalog' }
] as const;

function textOf(message: AssistantStoredMessage) {
  if (typeof message.content === 'string') return message.content;
  return String(message.content?.text || '');
}

function metaOf(message: AssistantStoredMessage) {
  if (typeof message.content === 'string') return '';
  const providers = message.content?.routing?.providers;
  return Array.isArray(providers) && providers.length ? `via ${providers.join(' + ')}` : '';
}

function providerClass(provider: AssistantProviderReadiness) {
  if (provider.state === 'verified') return 'atlas-ai-provider verified';
  if (provider.state === 'unavailable' || provider.state === 'rate-limited') return 'atlas-ai-provider unavailable';
  return 'atlas-ai-provider';
}

export function UnifiedAIChatPage() {
  const [status, setStatus] = useState<AssistantStatusResponse | null>(null);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [mode, setMode] = useState<AssistantMode>('auto');
  const [profile, setProfile] = useState<AssistantProfile>('balanced');
  const [prompt, setPrompt] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState('');
  const messageEnd = useRef<HTMLDivElement | null>(null);

  const providers = status?.providers || [];
  const verifiedProviders = providers.filter((provider) => provider.verified && provider.state === 'verified');
  const selectedProvider = mode === 'auto' || mode === 'council'
    ? null
    : providers.find((provider) => provider.id === mode) || null;
  const routeReady = mode === 'auto'
    ? verifiedProviders.length > 0
    : mode === 'council'
      ? verifiedProviders.length >= 2
      : selectedProvider?.verified === true && selectedProvider.state === 'verified';

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) || null,
    [conversationId, conversations]
  );

  const filteredConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => (conversation.title || 'Untitled conversation').toLowerCase().includes(query));
  }, [conversations, historyQuery]);

  useEffect(() => {
    let active = true;
    Promise.all([getAssistantStatus(), listAssistantConversations()])
      .then(([nextStatus, nextConversations]) => {
        if (!active) return;
        setStatus(nextStatus);
        setConversations(nextConversations);
        setError('');
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'assistant_unavailable');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function refreshStatus() {
    try {
      setStatus(await getAssistantStatus());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'status_unavailable');
    }
  }

  async function refreshHistory() {
    try {
      setConversations(await listAssistantConversations());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'history_unavailable');
    }
  }

  async function openConversation(id: string) {
    if (loadingConversation) return;
    setLoadingConversation(true);
    setError('');
    try {
      const payload = await getAssistantConversation(id);
      setConversationId(payload.conversation.id);
      setMessages((payload.messages || []).map((message, index) => ({
        key: message.id || `${message.role}-${index}`,
        role: message.role === 'user' ? 'user' : 'assistant',
        text: textOf(message),
        meta: metaOf(message)
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'conversation_unavailable');
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setPrompt('');
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || busy || !routeReady) return;

    setMessages((current) => [...current, { key: `local-${Date.now()}`, role: 'user', text: message }]);
    setPrompt('');
    setBusy(true);
    setError('');

    try {
      const result = await sendAssistantWorkspaceMessage({ message, conversationId, mode, profile });
      if (result.conversation_id) setConversationId(result.conversation_id);
      const providersUsed = Array.isArray(result.providers) && result.providers.length
        ? result.providers.join(' + ')
        : result.provider || 'ATLAS';
      setMessages((current) => [...current, {
        key: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result.output || result.text || '',
        meta: `via ${providersUsed}${result.model ? ` · ${result.model}` : ''}`
      }]);
      await Promise.all([refreshHistory(), refreshStatus()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'assistant_request_failed');
    } finally {
      setBusy(false);
    }
  }

  const councilConfigured = status?.cost_policy?.allow_council === true;
  const localProvider = providers.find((provider) => provider.id === 'atlas-local') || null;
  const localRuntimeVerified = status?.local_runtime?.state === 'verified'
    && Boolean(status?.local_runtime?.last_verified_at)
    && localProvider?.verified === true
    && localProvider?.state === 'verified';

  return (
    <section className="atlas-ai-enterprise" aria-label="ATLAS Enterprise Intelligence">
      <aside className="atlas-ai-rail" aria-label="ATLAS Assistant conversations and enterprise tools">
        <div className="atlas-ai-rail-brand">
          <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
          <div>
            <strong>ATLAS Intelligence</strong>
            <span>Enterprise workspace</span>
          </div>
        </div>

        <button className="atlas-ai-new" type="button" onClick={startNewConversation}>＋ New chat</button>

        <label className="atlas-ai-history-search">
          <span className="sr-only">Search conversations</span>
          <input
            type="search"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search chats"
          />
        </label>

        <nav className="atlas-ai-enterprise-links" aria-label="Enterprise intelligence tools">
          {ENTERPRISE_LINKS.map((item) => (
            <Link key={item.to} to={item.to}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </nav>

        <div className="atlas-ai-history">
          <span className="atlas-ai-section-label">Chats</span>
          {filteredConversations.length ? filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === conversationId ? 'active' : ''}
              onClick={() => openConversation(conversation.id)}
              disabled={loadingConversation}
            >
              <strong>{conversation.title || 'Untitled conversation'}</strong>
            </button>
          )) : <p className="atlas-ai-empty">{historyQuery ? 'No matching chats.' : 'No conversations yet.'}</p>}
        </div>

        <div className="atlas-ai-workspace-status">
          <span>{status?.organization || 'ATLAS Enterprise Suite'}</span>
          <strong>{status?.role ? status.role.toUpperCase() : status ? 'MEMBER' : 'CHECKING'}</strong>
        </div>
      </aside>

      <div className="atlas-ai-conversation-shell">
        <header className="atlas-ai-topbar">
          <div className="atlas-ai-topbar-title">
            <span className="eyebrow">ATLAS Enterprise Suite</span>
            <strong>{currentConversation?.title || 'New conversation'}</strong>
          </div>

          <div className="atlas-ai-topbar-controls">
            <label>
              <span className="sr-only">AI mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as AssistantMode)}>
                {MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Reasoning profile</span>
              <select value={profile} onChange={(event) => setProfile(event.target.value as AssistantProfile)}>
                {PROFILES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={refreshStatus}>Status</button>
          </div>
        </header>

        <div className="atlas-ai-enterprise-state" aria-label="Enterprise security and provider state">
          <span className={status?.authenticated ? 'verified' : ''}>
            {status?.authenticated ? 'Authenticated workspace' : 'Checking identity'}
          </span>
          <span>{status?.storage_state === 'configured' ? 'Conversation storage configured' : 'Storage not configured'}</span>
          <span>{verifiedProviders.length} verified provider{verifiedProviders.length === 1 ? '' : 's'}</span>
          <span>{councilConfigured ? 'Council enabled' : 'Council approval controlled'}</span>
          <span>{localRuntimeVerified ? 'ATLAS Local verified' : 'ATLAS Local not verified'}</span>
        </div>

        {error ? <div className="atlas-ai-error" role="alert">{error}</div> : null}
        {!routeReady && status ? (
          <div className="atlas-ai-notice">
            {mode === 'council'
              ? 'Council needs at least two verified providers before it can run.'
              : mode === 'auto'
                ? 'No verified provider is available yet. Configure and verify a provider before sending.'
                : `${mode} is not verified for this request yet.`}
          </div>
        ) : null}

        <main className="atlas-ai-chat">
          <div className="atlas-ai-messages" aria-live="polite">
            {messages.length ? messages.map((message) => (
              <article key={message.key} className={`atlas-ai-message ${message.role}`}>
                <div className="atlas-ai-message-role">{message.role === 'user' ? 'You' : 'ATLAS'}</div>
                <div>{message.text}</div>
                {message.meta ? <span className="atlas-ai-meta">{message.meta}</span> : null}
              </article>
            )) : (
              <section className="atlas-ai-welcome">
                <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
                <p className="eyebrow">ATLAS Intelligence</p>
                <h1>What can I help your organization do?</h1>
                <p>
                  Chat, analyze, coordinate Work, use approved connections and route actions through ATLAS permissions,
                  approval and audit controls.
                </p>
                <div className="atlas-ai-starters">
                  {PROMPT_STARTERS.map((starter) => (
                    <button key={starter} type="button" onClick={() => setPrompt(starter)}>{starter}</button>
                  ))}
                </div>
              </section>
            )}
            <div ref={messageEnd} />
          </div>

          <form className="atlas-ai-composer" onSubmit={submit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={routeReady ? 'Message ATLAS…' : 'A verified provider is required before sending'}
              aria-label="Message ATLAS Assistant"
              disabled={busy}
              rows={1}
            />
            <div className="atlas-ai-composer-meta">
              <span>{mode} · {profile}</span>
              <Link to="/work/connections">Apps</Link>
              <Link to="/work">Work</Link>
            </div>
            <button className="atlas-ai-send" type="submit" disabled={busy || !routeReady || !prompt.trim()} aria-label="Send message">
              {busy ? '…' : '↑'}
            </button>
          </form>

          <p className="atlas-ai-disclaimer">
            ATLAS applies organization scope, provider readiness, permissions and approval policy before governed execution.
          </p>
        </main>

        <footer className="atlas-ai-provider-strip" aria-label="Provider readiness">
          {providers.length ? providers.map((provider) => (
            <span key={provider.id} className={providerClass(provider)}>
              {provider.id} · {provider.state}{provider.model ? ` · ${provider.model}` : ''}
            </span>
          )) : <span className="atlas-ai-provider">Checking provider readiness…</span>}
        </footer>
      </div>
    </section>
  );
}
