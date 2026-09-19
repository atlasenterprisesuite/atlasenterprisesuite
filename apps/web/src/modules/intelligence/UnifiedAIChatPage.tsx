import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  { value: 'openai', label: 'ChatGPT / OpenAI' },
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
  const localVerifiedAt = status?.local_runtime?.last_verified_at
    ? new Date(status.local_runtime.last_verified_at).toLocaleString()
    : 'Not verified';

  return (
    <section className="page-stack atlas-ai-page atlas-ai-future">
      <header className="page-header atlas-ai-hero">
        <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
        <div>
          <p className="eyebrow">ATLAS Enterprise Suite · Intelligence Layer</p>
          <h1>ATLAS AI</h1>
          <p className="atlas-ai-tagline">Ask. Build. Analyze. Automate. <strong>All in one place.</strong></p>
          <div className="atlas-ai-capabilities" aria-label="ATLAS AI capabilities">
            <span>◉ Reason <small>Deep insight</small></span>
            <span>▣ Create <small>Any content</small></span>
            <span>⌘ Build <small>Turn ideas into reality</small></span>
            <span>⌕ Research <small>Find the truth</small></span>
          </div>
        </div>
      </header>

      <nav className="atlas-ai-switch" aria-label="Workspace">
        <button type="button" className="active">Chat</button>
        <button type="button">Work</button>
      </nav>
      <div className="atlas-ai-toolbar">
        <div className="atlas-ai-selectors">
          <label>
            <span>AI mode</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as AssistantMode)}>
              {MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>Reasoning profile</span>
            <select value={profile} onChange={(event) => setProfile(event.target.value as AssistantProfile)}>
              {PROFILES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={refreshStatus}>Refresh provider status</button>
      </div>

      <div className="atlas-ai-providers" aria-label="Provider readiness">
        {providers.length ? providers.map((provider) => (
          <span key={provider.id} className={providerClass(provider)}>
            {provider.id} · {provider.state}{provider.model ? ` · ${provider.model}` : ''}
          </span>
        )) : <span className="atlas-ai-provider">Checking provider readiness…</span>}
      </div>

      <section className={`atlas-local-live-card ${localRuntimeVerified ? 'verified' : 'pending'}`} aria-live="polite">
        <div>
          <p className="eyebrow">Sovereign runtime</p>
          <h2>ATLAS Local AI</h2>
          <p>{localRuntimeVerified
            ? 'Protected local inference is server-verified and available to this authenticated ATLAS workspace.'
            : 'ATLAS Local is not presented as live until runtime and provider verification both pass.'}</p>
        </div>
        <dl>
          <div><dt>Status</dt><dd>{localRuntimeVerified ? 'LIVE / VERIFIED' : 'NOT VERIFIED'}</dd></div>
          <div><dt>Provider</dt><dd>ATLAS Local</dd></div>
          <div><dt>Model</dt><dd>{localProvider?.model || 'Unavailable'}</dd></div>
          <div><dt>Last verified</dt><dd>{localVerifiedAt}</dd></div>
          <div><dt>API cost</dt><dd>{status?.cost_policy?.enforce_zero_cost ? '$0 automatic paid calls' : 'Policy controlled'}</dd></div>
        </dl>
      </section>

      {error ? <div className="atlas-ai-error" role="alert">{error}</div> : null}
      {!routeReady && status ? (
        <div className="atlas-ai-notice">
          {mode === 'council'
            ? 'Council needs at least two verified providers before it can run.'
            : mode === 'auto'
              ? 'No verified provider is available yet. Configure a provider on the server before sending.'
              : `${mode} is not verified for this request yet.`}
        </div>
      ) : null}

      <div className="atlas-ai-grid">
        <aside className="atlas-ai-panel">
          <h2>History</h2>
          <button className="atlas-ai-new" type="button" onClick={startNewConversation}>New conversation</button>
          <div className="atlas-ai-history">
            {conversations.length ? conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={conversation.id === conversationId ? 'active' : ''}
                onClick={() => openConversation(conversation.id)}
                disabled={loadingConversation}
              >
                <strong>{conversation.title || 'Untitled conversation'}</strong>
              </button>
            )) : <p className="atlas-ai-empty">No conversations yet.</p>}
          </div>
        </aside>

        <section className="atlas-ai-panel atlas-ai-chat">
          <h2>{currentConversation?.title || 'New conversation'}</h2>
          <div className="atlas-ai-messages" aria-live="polite">
            {messages.length ? messages.map((message) => (
              <div key={message.key} className={`atlas-ai-message ${message.role}`}>
                {message.text}
                {message.meta ? <span className="atlas-ai-meta">{message.meta}</span> : null}
              </div>
            )) : (
              <div className="atlas-ai-message assistant">
                Ask ATLAS Assistant. The selected provider must be verified before the request is sent.
              </div>
            )}
            <div ref={messageEnd} />
          </div>
          <form className="atlas-ai-composer" onSubmit={submit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Message ATLAS AI…"
              aria-label="Message ATLAS Assistant"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !routeReady || !prompt.trim()}>
              {busy ? '…' : '↑'}
            </button>
          </form>
        </section>

        <aside className="atlas-ai-panel atlas-ai-diagnostics">
          <h3>Execution state</h3>
          <dl>
            <div><dt>Organization</dt><dd>{status?.organization || 'Loading…'}</dd></div>
            <div><dt>Role</dt><dd>{status?.role || 'Loading…'}</dd></div>
            <div><dt>Storage</dt><dd>{status?.storage_state || 'Loading…'}</dd></div>
            <div><dt>Verified providers</dt><dd>{verifiedProviders.length}</dd></div>
            <div><dt>Council policy</dt><dd>{councilConfigured ? 'Pre-authorized' : 'Approval may be required'}</dd></div>
          </dl>
          <a className="atlas-ai-link" href="https://chatgpt.com" target="_blank" rel="noopener noreferrer">Open ChatGPT separately</a>
          <p className="atlas-ai-empty">The external link is optional. ATLAS requests stay on the governed server API.</p>
        </aside>
      </div>
    </section>
  );
}
