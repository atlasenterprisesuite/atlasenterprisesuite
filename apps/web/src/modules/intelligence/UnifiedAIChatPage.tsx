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

const MODES: Array<{ value: AssistantMode; label: string; short: string }> = [
  { value: 'auto', label: 'Auto · $0 first', short: 'Auto' },
  { value: 'atlas-local', label: 'ATLAS Local · $0 API', short: 'ATLAS Local' },
  { value: 'openai', label: 'OpenAI', short: 'OpenAI' },
  { value: 'bedrock', label: 'OpenAI on AWS Bedrock', short: 'Bedrock' },
  { value: 'gemini', label: 'Gemini', short: 'Gemini' },
  { value: 'codex-sovereign', label: 'Codex Sovereign', short: 'Codex' },
  { value: 'council', label: 'Council', short: 'Council' }
];

const PROFILES: Array<{ value: AssistantProfile; label: string }> = [
  { value: 'fast', label: 'Fast' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'deep', label: 'Deep' }
];

const PROMPT_STARTERS = [
  { title: 'Catch me up', text: 'Summarize what changed across this organization today.' },
  { title: 'Find answers', text: 'Find the most relevant information across connected ATLAS sources and cite it.' },
  { title: 'Plan work', text: 'Create a governed work plan for this request and identify approvals before execution.' },
  { title: 'Check risk', text: 'Review this request for security, cost, permissions and execution risk.' }
] as const;

const ENTERPRISE_LINKS = [
  { to: '/work', label: 'Work' },
  { to: '/automations', label: 'Agents' },
  { to: '/work/connections', label: 'Apps' },
  { to: '/work/team', label: 'Team' },
  { to: '/work/policies', label: 'Policies' },
  { to: '/suite', label: 'Modules' }
] as const;

function textOf(message: AssistantStoredMessage) {
  if (typeof message.content === 'string') return message.content;
  return String(message.content?.text || '');
}

function metaOf(message: AssistantStoredMessage) {
  if (typeof message.content === 'string') return '';
  const providers = message.content?.routing?.providers;
  return Array.isArray(providers) && providers.length ? 'via ' + providers.join(' + ') : '';
}

function humanizeError(value: string) {
  const errors: Record<string, string> = {
    assistant_unavailable: 'ATLAS AI is temporarily unavailable.',
    assistant_request_failed: 'ATLAS could not complete that request.',
    provider_unavailable: 'No verified AI provider is available right now.',
    provider_not_configured: 'The selected AI provider is not configured.',
    provider_auth_failed: 'The selected provider needs its server-side credentials repaired.',
    provider_rate_limited: 'The selected provider is temporarily rate limited.',
    no_provider_selected: 'No provider is available under the current cost policy.',
    paid_provider_blocked_by_zero_cost_policy: 'This provider is blocked by the current zero-cost policy.',
    cost_approval_required: 'This request needs cost approval before execution.',
    permission_denied: 'Your current ATLAS role does not permit this request.',
    conversation_unavailable: 'That conversation could not be loaded.',
    history_unavailable: 'Conversation history could not be loaded.',
    status_unavailable: 'Provider status could not be refreshed.'
  };
  return errors[value] || value.replaceAll('_', ' ');
}

function providerStateLabel(state: string) {
  return state.replaceAll('-', ' ').replaceAll('_', ' ');
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
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
    return conversations.filter((conversation) =>
      (conversation.title || 'Untitled conversation').toLowerCase().includes(query)
    );
  }, [conversations, historyQuery]);

  const selectedMode = MODES.find((item) => item.value === mode) || MODES[0];
  const selectedProfile = PROFILES.find((item) => item.value === profile) || PROFILES[1];

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
  }, [messages, busy]);

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
    setSidebarOpen(false);
    setError('');
    try {
      const payload = await getAssistantConversation(id);
      setConversationId(payload.conversation.id);
      setMessages((payload.messages || []).map((message, index) => ({
        key: message.id || message.role + '-' + index,
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
    setToolsOpen(false);
    setSidebarOpen(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || busy || !routeReady) return;

    setMessages((current) => [
      ...current,
      { key: 'local-' + Date.now(), role: 'user', text: message }
    ]);
    setPrompt('');
    setToolsOpen(false);
    setBusy(true);
    setError('');

    try {
      const result = await sendAssistantWorkspaceMessage({ message, conversationId, mode, profile });
      if (result.conversation_id) setConversationId(result.conversation_id);
      const providersUsed = Array.isArray(result.providers) && result.providers.length
        ? result.providers.join(' + ')
        : result.provider || 'ATLAS';
      setMessages((current) => [
        ...current,
        {
          key: 'assistant-' + Date.now(),
          role: 'assistant',
          text: result.output || result.text || '',
          meta: 'via ' + providersUsed + (result.model ? ' · ' + result.model : '')
        }
      ]);
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
    <section className={'atlas-ai-app' + (sidebarOpen ? ' sidebar-open' : '')} aria-label="ATLAS AI">
      <button
        className="atlas-ai-mobile-scrim"
        type="button"
        aria-label="Close conversation sidebar"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="atlas-ai-sidebar" aria-label="ATLAS AI conversations">
        <div className="atlas-ai-sidebar-head">
          <Link className="atlas-ai-brand" to="/suite" aria-label="ATLAS Enterprise Suite">
            <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
            <span>ATLAS</span>
          </Link>
          <button className="atlas-ai-icon-button" type="button" onClick={startNewConversation} aria-label="New chat">
            <span aria-hidden="true">＋</span>
          </button>
        </div>

        <button className="atlas-ai-new-chat" type="button" onClick={startNewConversation}>
          <span aria-hidden="true">✎</span>
          <span>New chat</span>
        </button>

        <label className="atlas-ai-search">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search chats</span>
          <input
            type="search"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Search chats"
          />
        </label>

        <div className="atlas-ai-history">
          <div className="atlas-ai-sidebar-label">Chats</div>
          {filteredConversations.length ? filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === conversationId ? 'active' : ''}
              onClick={() => openConversation(conversation.id)}
              disabled={loadingConversation}
              title={conversation.title || 'Untitled conversation'}
            >
              <span>{conversation.title || 'Untitled conversation'}</span>
            </button>
          )) : (
            <p className="atlas-ai-empty-history">
              {historyQuery ? 'No matching chats.' : 'Your conversations will appear here.'}
            </p>
          )}
        </div>

        <nav className="atlas-ai-sidebar-nav" aria-label="ATLAS AI tools">
          {ENTERPRISE_LINKS.map((item) => (
            <Link key={item.to} to={item.to}>{item.label}</Link>
          ))}
        </nav>

        <div className="atlas-ai-account">
          <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
          <div>
            <strong>{status?.organization || 'ATLAS Enterprise Suite'}</strong>
            <span>{status?.role ? status.role.toUpperCase() : status ? 'MEMBER' : 'CHECKING'}</span>
          </div>
        </div>
      </aside>

      <div className="atlas-ai-main">
        <header className="atlas-ai-header">
          <div className="atlas-ai-header-left">
            <button
              className="atlas-ai-icon-button atlas-ai-mobile-menu"
              type="button"
              aria-label="Open conversation sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <button
              className="atlas-ai-model-button"
              type="button"
              onClick={() => setStatusOpen((current) => !current)}
              aria-expanded={statusOpen}
              aria-controls="atlas-ai-status-panel"
            >
              <strong>ATLAS AI</strong>
              <span>{selectedMode.short} · {selectedProfile.label}</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </div>

          <div className="atlas-ai-header-actions">
            <button className="atlas-ai-text-button" type="button" onClick={startNewConversation}>New chat</button>
            <button
              className={'atlas-ai-status-dot ' + (routeReady ? 'ready' : 'not-ready')}
              type="button"
              aria-label={routeReady ? 'AI status ready' : 'AI status needs attention'}
              onClick={() => setStatusOpen((current) => !current)}
            >
              <span />
            </button>
          </div>

          {statusOpen ? (
            <aside id="atlas-ai-status-panel" className="atlas-ai-status-panel" aria-label="ATLAS AI status">
              <div className="atlas-ai-status-panel-head">
                <div>
                  <strong>AI controls</strong>
                  <span>Provider routing and governance</span>
                </div>
                <button type="button" onClick={refreshStatus}>Refresh</button>
              </div>

              <label className="atlas-ai-select-row">
                <span>Model route</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as AssistantMode)}>
                  {MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="atlas-ai-select-row">
                <span>Reasoning</span>
                <select value={profile} onChange={(event) => setProfile(event.target.value as AssistantProfile)}>
                  {PROFILES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <div className="atlas-ai-status-grid">
                <span><i className={status?.authenticated ? 'ok' : ''} />Identity</span>
                <strong>{status?.authenticated ? 'Verified' : 'Checking'}</strong>
                <span><i className={status?.storage_state === 'configured' ? 'ok' : ''} />History</span>
                <strong>{status?.storage_state === 'configured' ? 'Ready' : 'Needs setup'}</strong>
                <span><i className={verifiedProviders.length ? 'ok' : ''} />Providers</span>
                <strong>{verifiedProviders.length} verified</strong>
                <span><i className={localRuntimeVerified ? 'ok' : ''} />ATLAS Local</span>
                <strong>{localRuntimeVerified ? 'Verified' : 'Not verified'}</strong>
                <span><i className={councilConfigured ? 'ok' : ''} />Council</span>
                <strong>{councilConfigured ? 'Enabled' : 'Approval controlled'}</strong>
              </div>

              {providers.length ? (
                <div className="atlas-ai-provider-list">
                  {providers.map((provider) => (
                    <div key={provider.id}>
                      <span>{provider.id}</span>
                      <strong className={provider.verified && provider.state === 'verified' ? 'ready' : ''}>
                        {providerStateLabel(provider.state)}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="atlas-ai-status-links">
                <Link to="/work/connections">Manage apps</Link>
                <Link to="/work/policies">Policies</Link>
              </div>
            </aside>
          ) : null}
        </header>

        <main className="atlas-ai-thread">
          {error ? (
            <div className="atlas-ai-alert" role="alert">
              <span>{humanizeError(error)}</span>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
            </div>
          ) : null}

          {!routeReady && status ? (
            <div className="atlas-ai-route-notice">
              {mode === 'council'
                ? 'Council needs at least two verified providers.'
                : mode === 'auto'
                  ? 'No verified provider is available. Open AI controls to repair provider readiness.'
                  : selectedMode.short + ' is not verified for this request.'}
            </div>
          ) : null}

          <div className={'atlas-ai-messages' + (messages.length ? '' : ' empty')}>
            {messages.length ? messages.map((message) => (
              <article key={message.key} className={'atlas-ai-message ' + message.role}>
                {message.role === 'assistant' ? (
                  <div className="atlas-ai-assistant-mark" aria-hidden="true">
                    <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
                  </div>
                ) : null}
                <div className="atlas-ai-message-content">
                  <div className="atlas-ai-message-text">{message.text}</div>
                  {message.meta ? <span className="atlas-ai-message-meta">{message.meta}</span> : null}
                </div>
              </article>
            )) : (
              <section className="atlas-ai-welcome">
                <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
                <h1>What can I help with?</h1>
                <p>Ask ATLAS to analyze, plan, find information, or coordinate governed work across your organization.</p>
                <div className="atlas-ai-starters">
                  {PROMPT_STARTERS.map((starter) => (
                    <button key={starter.title} type="button" onClick={() => setPrompt(starter.text)}>
                      <strong>{starter.title}</strong>
                      <span>{starter.text}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {busy ? (
              <article className="atlas-ai-message assistant atlas-ai-thinking" aria-label="ATLAS is thinking">
                <div className="atlas-ai-assistant-mark" aria-hidden="true">
                  <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
                </div>
                <div className="atlas-ai-thinking-dots" aria-hidden="true"><span /><span /><span /></div>
              </article>
            ) : null}
            <div ref={messageEnd} />
          </div>

          <div className="atlas-ai-composer-wrap">
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
                placeholder={status
                  ? routeReady
                    ? 'Message ATLAS'
                    : 'Open AI controls to restore a verified provider'
                  : 'Checking ATLAS AI readiness…'}
                aria-label="Message ATLAS Assistant"
                disabled={busy}
                rows={1}
              />

              <div className="atlas-ai-composer-actions">
                <div className="atlas-ai-tools-wrap">
                  <button
                    className="atlas-ai-plus"
                    type="button"
                    aria-label="Open ATLAS tools"
                    aria-expanded={toolsOpen}
                    onClick={() => setToolsOpen((current) => !current)}
                  >
                    ＋
                  </button>
                  {toolsOpen ? (
                    <div className="atlas-ai-tools-menu">
                      <Link to="/work/connections" onClick={() => setToolsOpen(false)}>
                        <strong>Apps</strong><span>Connected tools</span>
                      </Link>
                      <Link to="/work" onClick={() => setToolsOpen(false)}>
                        <strong>Work</strong><span>Long-running execution</span>
                      </Link>
                      <Link to="/suite" onClick={() => setToolsOpen(false)}>
                        <strong>Modules</strong><span>Enterprise workspace</span>
                      </Link>
                    </div>
                  ) : null}
                </div>

                <span className="atlas-ai-composer-route">{selectedMode.short} · {selectedProfile.label}</span>

                <button
                  className="atlas-ai-send"
                  type="submit"
                  disabled={busy || !routeReady || !prompt.trim()}
                  aria-label="Send message"
                >
                  <span aria-hidden="true">↑</span>
                </button>
              </div>
            </form>

            <p className="atlas-ai-disclaimer">
              ATLAS can make mistakes. Verify important information and governed actions.
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}
