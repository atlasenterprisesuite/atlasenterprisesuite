import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAssistantVoice } from '../../assistant/useAssistantVoice';
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

type ConversationSpeaker = 'A' | 'B';

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
  { title: 'Prep my next meeting', text: 'Prepare me for my next meeting using the organization context available to ATLAS. Summarize the objective, relevant context, decisions needed and a concise agenda.' },
  { title: 'Draft follow-up', text: 'Draft a concise follow-up message for my most recent meeting. Separate decisions, owners, deadlines and next actions.' },
  { title: 'Summarize this contact', text: 'Summarize the current contact or customer context available in this workspace, including recent activity, open items and next actions.' },
  { title: 'Translator', text: 'Translate the following text accurately. Preserve meaning, names, numbers, formatting and professional tone. Ask for the target language only if it is not clear from my message:\n\n' }
] as const;

const PROMPT_LIBRARY = [
  { title: 'Translate', text: PROMPT_STARTERS[3].text },
  { title: 'Conversation', text: '' },
  { title: 'Summarize', text: 'Summarize the following content into key facts, decisions, risks and next actions:\n\n' },
  { title: 'Rewrite', text: 'Rewrite the following text clearly and professionally while preserving the original meaning:\n\n' },
  { title: 'Analyze', text: 'Analyze the following information. Separate facts, assumptions, risks, dependencies and recommended next steps:\n\n' }
] as const;

const TRANSLATOR_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'es-US', label: 'Spanish' },
  { code: 'pt-BR', label: 'Portuguese' },
  { code: 'fr-FR', label: 'French' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'de-DE', label: 'German' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'ar-SA', label: 'Arabic' }
] as const;

function translatorLanguageLabel(code: string) {
  return TRANSLATOR_LANGUAGES.find((language) => language.code === code)?.label || code;
}

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
    status_unavailable: 'Provider status could not be refreshed.',
    voice_transcription_unavailable: 'Voice transcription is unavailable in this browser. Text mode remains available.',
    voice_transcription_failed: 'ATLAS could not transcribe that voice turn. Try again or use text.',
    microphone_permission_denied: 'Microphone permission was denied. Text mode remains available.',
    speech_unavailable: 'Speech output is unavailable. The translated text remains available.'
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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en-US');
  const [conversationTranslatorEnabled, setConversationTranslatorEnabled] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [conversationSpeaker, setConversationSpeaker] = useState<ConversationSpeaker>('A');
  const [participantALanguage, setParticipantALanguage] = useState('es-US');
  const [participantBLanguage, setParticipantBLanguage] = useState('en-US');
  const conversationSessionRef = useRef(0);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const voice = useAssistantVoice();

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

  useEffect(() => () => {
    conversationSessionRef.current += 1;
  }, []);

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
    stopConversationSession();
    setConversationId(null);
    setMessages([]);
    setPrompt('');
    setError('');
    setToolsOpen(false);
    setPromptLibraryOpen(false);
    setMobileActionsOpen(false);
    setSidebarOpen(false);
  }

  function translationRequest(message: string) {
    if (!translatorEnabled) return message;
    const source = sourceLanguage === 'auto'
      ? 'Detect the source language automatically from the text.'
      : 'Source language: ' + translatorLanguageLabel(sourceLanguage) + '.';
    return [
      'ATLAS TRANSLATOR TASK',
      source,
      'Target language: ' + translatorLanguageLabel(targetLanguage) + '.',
      'Translate accurately and return only the translated content unless a genuine ambiguity prevents a reliable translation.',
      'Preserve names, numbers, dates, currency values, line breaks and document structure.',
      '',
      message
    ].join('\n');
  }

  function conversationTranslationRequest(message: string, speaker: ConversationSpeaker) {
    const sourceLanguageCode = speaker === 'A' ? participantALanguage : participantBLanguage;
    const targetLanguageCode = speaker === 'A' ? participantBLanguage : participantALanguage;
    return [
      'ATLAS TWO-PERSON CONVERSATION TRANSLATION',
      'Current speaker: Person ' + speaker + '.',
      'Source language: ' + translatorLanguageLabel(sourceLanguageCode) + '.',
      'Target language: ' + translatorLanguageLabel(targetLanguageCode) + '.',
      'Translate only the current speaker turn. Do not answer the speaker, add commentary, summarize, or identify the person.',
      'Preserve names, numbers, dates, currency values, tone and meaning.',
      '',
      message
    ].join('\n');
  }

  async function executeMessage(message: string) {
    const value = message.trim();
    if (!value || busy || !routeReady) return;

    setMessages((current) => [
      ...current,
      { key: 'local-' + Date.now(), role: 'user', text: value }
    ]);
    setToolsOpen(false);
    setBusy(true);
    setError('');

    try {
      const result = await sendAssistantWorkspaceMessage({
        message: translationRequest(value),
        conversationId,
        mode,
        profile
      });
      if (result.conversation_id) setConversationId(result.conversation_id);
      const providersUsed = Array.isArray(result.providers) && result.providers.length
        ? result.providers.join(' + ')
        : result.provider || 'ATLAS';
      const reply = result.output || result.text || '';
      setMessages((current) => [
        ...current,
        {
          key: 'assistant-' + Date.now(),
          role: 'assistant',
          text: reply,
          meta: (translatorEnabled ? 'translated to ' + translatorLanguageLabel(targetLanguage) + ' · ' : '')
            + 'via ' + providersUsed + (result.model ? ' · ' + result.model : '')
        }
      ]);
      if (translatorEnabled && voice.speechEnabled && voice.speechCapability === 'ready' && reply) {
        try {
          await voice.speak(reply, targetLanguage);
        } catch {
          setError('speech_unavailable');
        }
      }
      await Promise.all([refreshHistory(), refreshStatus()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'assistant_request_failed');
    } finally {
      setBusy(false);
    }
  }

  async function executeConversationTurn(
    message: string,
    speaker: ConversationSpeaker,
    sessionId: number
  ) {
    const value = message.trim();
    if (!value || busy || !routeReady) return false;

    const sourceLanguageCode = speaker === 'A' ? participantALanguage : participantBLanguage;
    const targetLanguageCode = speaker === 'A' ? participantBLanguage : participantALanguage;
    const listener: ConversationSpeaker = speaker === 'A' ? 'B' : 'A';

    setMessages((current) => [
      ...current,
      {
        key: 'conversation-source-' + Date.now(),
        role: 'user',
        text: value,
        meta: 'Person ' + speaker + ' · ' + translatorLanguageLabel(sourceLanguageCode)
      }
    ]);
    setBusy(true);
    setError('');

    try {
      const result = await sendAssistantWorkspaceMessage({
        message: conversationTranslationRequest(value, speaker),
        conversationId,
        mode,
        profile
      });
      if (result.conversation_id) setConversationId(result.conversation_id);
      const providersUsed = Array.isArray(result.providers) && result.providers.length
        ? result.providers.join(' + ')
        : result.provider || 'ATLAS';
      const reply = result.output || result.text || '';
      setMessages((current) => [
        ...current,
        {
          key: 'conversation-translation-' + Date.now(),
          role: 'assistant',
          text: reply,
          meta: 'for Person ' + listener + ' · ' + translatorLanguageLabel(targetLanguageCode)
            + ' · via ' + providersUsed + (result.model ? ' · ' + result.model : '')
        }
      ]);

      if (
        conversationSessionRef.current === sessionId
        && voice.speechEnabled
        && voice.speechCapability === 'ready'
        && reply
      ) {
        await voice.speak(reply, targetLanguageCode);
      }

      await Promise.all([refreshHistory(), refreshStatus()]);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'assistant_request_failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function startConversationTurn(speaker: ConversationSpeaker, sessionId: number) {
    if (conversationSessionRef.current !== sessionId) return;

    const recognitionLanguage = speaker === 'A' ? participantALanguage : participantBLanguage;
    setConversationSpeaker(speaker);

    try {
      await voice.startVoiceTurn(
        async (transcript) => {
          if (conversationSessionRef.current !== sessionId) return;
          const translated = await executeConversationTurn(transcript, speaker, sessionId);
          if (!translated || conversationSessionRef.current !== sessionId) {
            stopConversationSession();
            return;
          }
          const nextSpeaker: ConversationSpeaker = speaker === 'A' ? 'B' : 'A';
          setConversationSpeaker(nextSpeaker);
          window.setTimeout(() => {
            if (conversationSessionRef.current === sessionId) {
              void startConversationTurn(nextSpeaker, sessionId);
            }
          }, 250);
        },
        (cause) => {
          if (conversationSessionRef.current !== sessionId) return;
          setError(cause instanceof Error ? cause.message : 'voice_transcription_failed');
          stopConversationSession();
        },
        recognitionLanguage
      );
    } catch (cause) {
      if (conversationSessionRef.current !== sessionId) return;
      setError(cause instanceof Error ? cause.message : 'voice_transcription_failed');
      stopConversationSession();
    }
  }

  function stopConversationSession() {
    conversationSessionRef.current += 1;
    setConversationActive(false);
    voice.stopMicrophone();
    voice.stopSpeech();
  }

  function startConversationSession() {
    if (!routeReady) {
      setError('provider_unavailable');
      return;
    }
    if (voice.transcriptionCapability !== 'ready') {
      setError('voice_transcription_unavailable');
      return;
    }
    if (voice.speechCapability !== 'ready') {
      setError('speech_unavailable');
      return;
    }
    if (!voice.speechEnabled) {
      voice.setSpeechEnabled(true);
      setError('');
      return;
    }

    const sessionId = conversationSessionRef.current + 1;
    conversationSessionRef.current = sessionId;
    setConversationActive(true);
    setConversationSpeaker('A');
    setError('');
    void startConversationTurn('A', sessionId);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || busy || !routeReady) return;
    setPrompt('');
    await executeMessage(message);
  }

  async function toggleMicrophone() {
    if (voice.microphoneActive) {
      voice.stopMicrophone();
      return;
    }
    if (voice.transcriptionCapability !== 'ready') {
      setError('voice_transcription_unavailable');
      return;
    }
    try {
      await voice.startVoiceTurn(
        (transcript) => {
          setError('');
          if (translatorEnabled) {
            setPrompt('');
            void executeMessage(transcript);
          } else {
            setPrompt(transcript);
          }
        },
        (cause) => setError(cause instanceof Error ? cause.message : 'voice_transcription_failed'),
        sourceLanguage === 'auto' ? undefined : sourceLanguage
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'voice_transcription_failed');
    }
  }

  function usePrompt(text: string) {
    setPrompt(text);
    setPromptLibraryOpen(false);
    setMobileActionsOpen(false);
  }

  function activateTranslator() {
    stopConversationSession();
    setConversationTranslatorEnabled(false);
    setTranslatorEnabled(true);
    setPrompt('');
    setPromptLibraryOpen(false);
    setMobileActionsOpen(false);
    setError('');
  }

  function activateConversationTranslator() {
    stopConversationSession();
    setTranslatorEnabled(true);
    setConversationTranslatorEnabled(true);
    setPrompt('');
    setPromptLibraryOpen(false);
    setMobileActionsOpen(false);
    setError('');
    if (voice.speechCapability === 'ready' && !voice.speechEnabled) {
      voice.setSpeechEnabled(true);
    }
  }

  function swapTranslatorLanguages() {
    if (sourceLanguage === 'auto') return;
    const nextSource = targetLanguage;
    setTargetLanguage(sourceLanguage);
    setSourceLanguage(nextSource);
  }

  function swapConversationLanguages() {
    if (conversationActive) return;
    const nextA = participantBLanguage;
    setParticipantBLanguage(participantALanguage);
    setParticipantALanguage(nextA);
  }

  const conversationVoiceReady = routeReady
    && voice.transcriptionCapability === 'ready'
    && voice.speechCapability === 'ready'
    && voice.speechEnabled;

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
            <div className="atlas-ai-mobile-actions">
              <button
                className="atlas-ai-icon-button atlas-ai-mobile-more"
                type="button"
                aria-label="Open assistant menu"
                aria-expanded={mobileActionsOpen}
                onClick={() => setMobileActionsOpen((current) => !current)}
              >
                <span aria-hidden="true">⋮</span>
              </button>
              {mobileActionsOpen ? (
                <div className="atlas-ai-mobile-menu-popover">
                  <button type="button" onClick={() => { setSidebarOpen(true); setMobileActionsOpen(false); }}>
                    <strong>Chat history</strong><span>Open previous conversations</span>
                  </button>
                  <Link to="/work" onClick={() => setMobileActionsOpen(false)}>
                    <strong>Projects</strong><span>Open governed ATLAS Work</span>
                  </Link>
                  <button type="button" onClick={() => { setPromptLibraryOpen(true); setMobileActionsOpen(false); }}>
                    <strong>Prompts</strong><span>Open reusable prompt actions</span>
                  </button>
                </div>
              ) : null}
            </div>
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
                <h1>How can I help you?</h1>
                <p>Ask, translate, summarize, prepare work or use connected ATLAS context from one simple assistant.</p>
                <div className="atlas-ai-starters atlas-ai-starter-chips">
                  {PROMPT_STARTERS.map((starter) => (
                    <button
                      key={starter.title}
                      type="button"
                      onClick={() => starter.title === 'Translator' ? activateTranslator() : usePrompt(starter.text)}
                    >
                      <strong>{starter.title}</strong>
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
            {translatorEnabled ? (
              <section className="atlas-ai-translator-bar" aria-label="ATLAS Translator">
                <div className="atlas-ai-translator-head">
                  <div>
                    <strong>Translator</strong>
                    <span>{sourceLanguage === 'auto' ? 'Text auto-detect · voice uses device locale' : translatorLanguageLabel(sourceLanguage)} → {translatorLanguageLabel(targetLanguage)}</span>
                  </div>
                  <div className="atlas-ai-translator-head-actions">
                    <button
                      type="button"
                      className={conversationTranslatorEnabled ? 'active' : ''}
                      onClick={() => conversationTranslatorEnabled
                        ? (stopConversationSession(), setConversationTranslatorEnabled(false))
                        : activateConversationTranslator()}
                    >
                      Conversation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopConversationSession();
                        setConversationTranslatorEnabled(false);
                        setTranslatorEnabled(false);
                      }}
                      aria-label="Close translator"
                    >×</button>
                  </div>
                </div>
                {conversationTranslatorEnabled ? (
                  <div className="atlas-ai-conversation-translator">
                    <div className="atlas-ai-conversation-language-row">
                      <label>
                        <span>Person A</span>
                        <select
                          value={participantALanguage}
                          disabled={conversationActive}
                          onChange={(event) => setParticipantALanguage(event.target.value)}
                        >
                          {TRANSLATOR_LANGUAGES.map((language) => (
                            <option key={language.code} value={language.code}>{language.label}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="atlas-ai-translator-swap"
                        type="button"
                        disabled={conversationActive}
                        onClick={swapConversationLanguages}
                        aria-label="Swap conversation languages"
                      >⇄</button>
                      <label>
                        <span>Person B</span>
                        <select
                          value={participantBLanguage}
                          disabled={conversationActive}
                          onChange={(event) => setParticipantBLanguage(event.target.value)}
                        >
                          {TRANSLATOR_LANGUAGES.map((language) => (
                            <option key={language.code} value={language.code}>{language.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="atlas-ai-conversation-status">
                      <div>
                        <strong>{conversationActive ? 'Listening to Person ' + conversationSpeaker : 'Ready for Person A'}</strong>
                        <span>
                          {conversationActive
                            ? translatorLanguageLabel(conversationSpeaker === 'A' ? participantALanguage : participantBLanguage)
                              + ' → '
                              + translatorLanguageLabel(conversationSpeaker === 'A' ? participantBLanguage : participantALanguage)
                            : 'ATLAS alternates A/B turns and speaks each translation automatically.'}
                        </span>
                      </div>
                      <button
                        className={conversationActive ? 'stop' : 'start'}
                        type="button"
                        disabled={!conversationActive && !conversationVoiceReady}
                        onClick={conversationActive ? stopConversationSession : startConversationSession}
                      >
                        {conversationActive ? 'Stop' : 'Start live conversation'}
                      </button>
                    </div>

                    {!voice.speechEnabled && voice.speechCapability === 'ready' ? (
                      <button
                        className="atlas-ai-conversation-enable-speech"
                        type="button"
                        onClick={() => voice.setSpeechEnabled(true)}
                      >
                        Enable spoken translations
                      </button>
                    ) : null}

                    <p className="atlas-ai-conversation-boundary">
                      Speaker identity detection is not verified on this device. ATLAS assigns alternating Person A / Person B turns instead of guessing who is speaking.
                    </p>
                  </div>
                ) : (
                                  <div className="atlas-ai-translator-controls">
                                    <label>
                                      <span>From</span>
                                      <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
                                        <option value="auto">Auto detect</option>
                                        {TRANSLATOR_LANGUAGES.map((language) => (
                                          <option key={language.code} value={language.code}>{language.label}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <button
                                      className="atlas-ai-translator-swap"
                                      type="button"
                                      onClick={swapTranslatorLanguages}
                                      disabled={sourceLanguage === 'auto'}
                                      aria-label="Swap translation languages"
                                    >⇄</button>
                                    <label>
                                      <span>To</span>
                                      <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                                        {TRANSLATOR_LANGUAGES.map((language) => (
                                          <option key={language.code} value={language.code}>{language.label}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="atlas-ai-translator-speech">
                                      <input
                                        type="checkbox"
                                        checked={voice.speechEnabled && voice.speechCapability === 'ready'}
                                        disabled={voice.speechCapability !== 'ready'}
                                        onChange={(event) => voice.setSpeechEnabled(event.target.checked)}
                                      />
                                      <span>Speak translation</span>
                                    </label>
                                  </div>
                  
                )}
              </section>
            ) : null}

            <form className={'atlas-ai-composer' + (translatorEnabled ? ' translator-active' : '')} onSubmit={submit}>
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
                    ? conversationTranslatorEnabled
                      ? conversationActive
                        ? 'Live conversation is listening automatically…'
                        : 'Start live conversation above'
                      : translatorEnabled
                        ? 'Speak or type to translate…'
                        : 'Message ATLAS'
                    : 'Open AI controls to restore a verified provider'
                  : 'Checking ATLAS AI readiness…'}
                aria-label="Message ATLAS Assistant"
                disabled={busy || conversationActive}
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
                      <button type="button" onClick={() => { setPromptLibraryOpen(true); setToolsOpen(false); }}>
                        <strong>Prompts</strong><span>Reusable actions and translator</span>
                      </button>
                      <Link to="/work/connections" onClick={() => setToolsOpen(false)}>
                        <strong>Apps</strong><span>Connected tools</span>
                      </Link>
                      <Link to="/work" onClick={() => setToolsOpen(false)}>
                        <strong>Projects</strong><span>Governed long-running work</span>
                      </Link>
                      <Link to="/suite" onClick={() => setToolsOpen(false)}>
                        <strong>Modules</strong><span>Enterprise workspace</span>
                      </Link>
                    </div>
                  ) : null}
                </div>

                <span className="atlas-ai-composer-route">{selectedMode.short} · {selectedProfile.label}</span>

                <button
                  className={'atlas-ai-mic' + (voice.microphoneActive ? ' active' : '')}
                  type="button"
                  aria-label={voice.microphoneActive ? 'Stop microphone' : 'Use microphone'}
                  aria-pressed={voice.microphoneActive}
                  disabled={busy || voice.transcriptionCapability !== 'ready'}
                  onClick={() => void toggleMicrophone()}
                >
                  {voice.microphoneActive ? (
                    <span aria-hidden="true">■</span>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="12" rx="3" />
                      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
                    </svg>
                  )}
                </button>

                <Link className="atlas-ai-voice-link" to="/voice" aria-label="Open ATLAS Voice">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 14v-4M8 18V6M12 21V3M16 18V6M20 14v-4" />
                  </svg>
                </Link>

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

            {promptLibraryOpen ? (
              <section className="atlas-ai-prompt-library" aria-label="ATLAS prompt library">
                <div className="atlas-ai-prompt-library-head">
                  <div><strong>Prompts</strong><span>Choose an action, then add your content.</span></div>
                  <button type="button" onClick={() => setPromptLibraryOpen(false)} aria-label="Close prompts">×</button>
                </div>
                <div className="atlas-ai-prompt-library-grid">
                  {PROMPT_LIBRARY.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => item.title === 'Translate'
                        ? activateTranslator()
                        : item.title === 'Conversation'
                          ? activateConversationTranslator()
                          : usePrompt(item.text)}
                    >
                      <strong>{item.title}</strong>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="atlas-ai-disclaimer">
              ATLAS can make mistakes. Verify important information and governed actions.
            </p>
          </div>
        </main>
      </div>
    </section>
  );
}
