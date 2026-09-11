import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sendAssistantMessage } from '../../assistant/client';
import { resolveAssistantModule } from '../../assistant/routeContext';
import { markGreetingSeen, readGreetingSeen } from '../../assistant/storage';
import type { AtlasAssistantMessage, AtlasAssistantUiState } from '../../assistant/types';
import { useAssistantVoice } from '../../assistant/useAssistantVoice';
import { ATLAS_SESSION_EVENT, getActiveAtlasOrganization } from '../../lib/atlasSession';
import { AtlasAssistantLauncher } from './AtlasAssistantLauncher';
import { AtlasAssistantPanel } from './AtlasAssistantPanel';
import './assistant.css';

const GREETING = 'ATLAS Assistant is ready. How can I help in this workspace?';

function readableModule(moduleName: string) {
  if (moduleName === 'atlas.home') return 'Enterprise workspace';
  return moduleName.split('.').map((part) => part.replace(/-/g, ' ')).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' · ');
}

function errorMessage(cause: unknown) {
  const code = cause instanceof Error ? cause.message : String(cause || 'assistant_request_failed');
  if (code === 'authentication_required' || code === 'session_expired') return 'Your ATLAS session expired. Sign in again to continue.';
  if (code === 'no_active_organization' || code === 'active_organization_required') return 'ATLAS could not resolve an active organization for this session.';
  if (code === 'permission_denied') return 'Your ATLAS role does not include permission to use Intelligence.';
  if (code === 'provider_not_configured') return 'ATLAS Intelligence is not configured for this environment.';
  if (code === 'provider_rate_limited') return 'ATLAS Intelligence is temporarily rate limited. Try again shortly.';
  if (code === 'provider_unavailable') return 'ATLAS Intelligence is temporarily unavailable.';
  if (code === 'microphone_permission_denied') return 'Microphone permission was denied. Text mode remains available.';
  if (code === 'microphone_unsupported' || code === 'microphone_unavailable') return 'Microphone capture is unavailable. Text mode remains available.';
  if (code === 'speech_unavailable') return 'Speech output is unavailable. The assistant reply remains available as text.';
  return 'ATLAS Assistant could not complete that request.';
}

export function AtlasAssistant() {
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AtlasAssistantUiState>('closed');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<AtlasAssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const sequence = useRef(0);
  const greetingSpoken = useRef(false);
  const moduleName = useMemo(() => resolveAssistantModule(location.pathname), [location.pathname]);
  const voice = useAssistantVoice();

  const nextId = useCallback((role: 'assistant' | 'user') => {
    sequence.current += 1;
    return `${role}-${sequence.current}`;
  }, []);

  const refreshAuthorization = useCallback(async () => {
    try {
      await getActiveAtlasOrganization();
      setAuthorized(true);
    } catch {
      voice.stopMicrophone();
      setAuthorized(false);
      setOpen(false);
      setState('closed');
    }
  }, [voice.stopMicrophone]);

  useEffect(() => {
    void refreshAuthorization();
    const handleSession = () => void refreshAuthorization();
    window.addEventListener(ATLAS_SESSION_EVENT, handleSession);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSession);
  }, [refreshAuthorization]);

  useEffect(() => {
    if (!authorized || readGreetingSeen()) return;
    markGreetingSeen();
    setMessages((current) => current.length ? current : [{
      id: nextId('assistant'),
      role: 'assistant',
      text: GREETING
    }]);
  }, [authorized, nextId]);

  if (!authorized) return null;

  async function submit(message: string) {
    if (voice.microphoneActive) voice.stopMicrophone();
    setError('');
    setState('thinking');
    setMessages((current) => [...current, { id: nextId('user'), role: 'user', text: message }]);

    try {
      const response = await sendAssistantMessage({
        message,
        pathname: location.pathname,
        conversationId,
        modality: 'text'
      });
      if (response.conversation_id) setConversationId(response.conversation_id);
      setMessages((current) => [...current, {
        id: nextId('assistant'),
        role: 'assistant',
        text: response.text
      }]);

      if (voice.speechEnabled && voice.speechCapability === 'ready') {
        setState('speaking');
        try {
          await voice.speak(response.text);
          setState('idle');
        } catch (cause) {
          setError(errorMessage(cause));
          setState('error');
        }
      } else {
        setState('idle');
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
    }
  }

  async function toggleMicrophone() {
    setError('');
    if (voice.microphoneActive) {
      voice.stopMicrophone();
      setState('idle');
      return;
    }

    try {
      await voice.startMicrophone();
      setState('listening');
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
    }
  }

  function openAssistant() {
    setOpen(true);
    setError('');
    setState(voice.microphoneActive ? 'listening' : 'idle');

    if (!greetingSpoken.current && voice.speechEnabled && voice.speechCapability === 'ready' && messages.some((message) => message.role === 'assistant' && message.text === GREETING)) {
      greetingSpoken.current = true;
      setState('speaking');
      void voice.speak(GREETING).then(() => setState('idle')).catch((cause) => {
        setError(errorMessage(cause));
        setState('error');
      });
    }
  }

  function closeAssistant() {
    voice.stopMicrophone();
    setOpen(false);
    setState('closed');
    setError('');
  }

  return (
    <div className="atlas-assistant-root">
      {open ? (
        <AtlasAssistantPanel
          messages={messages}
          state={state}
          error={error}
          moduleLabel={readableModule(moduleName)}
          microphoneCapability={voice.microphoneCapability}
          microphoneActive={voice.microphoneActive}
          speechCapability={voice.speechCapability}
          speechEnabled={voice.speechEnabled}
          onClose={closeAssistant}
          onSubmit={submit}
          onToggleMicrophone={toggleMicrophone}
          onSpeechPreference={voice.setSpeechEnabled}
        />
      ) : (
        <AtlasAssistantLauncher state={state} onOpen={openAssistant} />
      )}
    </div>
  );
}
