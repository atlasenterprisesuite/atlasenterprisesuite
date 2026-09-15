import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAssistantStatus, sendAssistantMessage } from '../../assistant/client';
import { resolveAssistantModule } from '../../assistant/routeContext';
import { markGreetingSeen, readGreetingSeen } from '../../assistant/storage';
import type { AtlasAssistantMessage, AtlasAssistantUiState, AtlasCapabilityState } from '../../assistant/types';
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

function errorCode(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause || 'assistant_request_failed');
}

function identityFailure(cause: unknown) {
  const code = errorCode(cause);
  return code === 'authentication_required'
    || code === 'session_expired'
    || code === 'no_active_organization'
    || code === 'active_organization_required'
    || code === 'organization_membership_required';
}

function errorMessage(cause: unknown) {
  const code = errorCode(cause);
  if (code === 'authentication_required' || code === 'session_expired') return 'Your ATLAS session expired. Sign in again to continue.';
  if (code === 'no_active_organization' || code === 'active_organization_required' || code === 'organization_membership_required') return 'ATLAS could not resolve an active organization for this session.';
  if (code === 'permission_denied') return 'Your ATLAS role does not include permission to use Intelligence.';
  if (code === 'provider_not_configured') return 'ATLAS Intelligence is not configured for this environment.';
  if (code === 'provider_rate_limited') return 'ATLAS Intelligence is temporarily rate limited. Try again shortly.';
  if (code === 'provider_unavailable') return 'ATLAS Intelligence is temporarily unavailable.';
  if (code === 'microphone_permission_denied') return 'Microphone permission was denied. Text mode remains available.';
  if (code === 'microphone_unsupported' || code === 'microphone_unavailable') return 'Microphone capture is unavailable. Text mode remains available.';
  if (code === 'speech_unavailable') return 'Speech output is unavailable. The assistant reply remains available as text.';
  return 'ATLAS Assistant could not complete that request.';
}

function providerCapability(state: string): { capability: AtlasCapabilityState; label: string; message: string } {
  if (state === 'verified_for_request') return { capability: 'ready', label: 'ready', message: '' };
  if (state === 'not_configured' || state === 'configured_unverified') {
    return { capability: 'configuration-required', label: 'configuration required', message: 'ATLAS Intelligence is not verified for requests in this environment.' };
  }
  return { capability: 'unavailable', label: 'unavailable', message: 'ATLAS Intelligence is temporarily unavailable.' };
}

export function AtlasAssistant() {
  const location = useLocation();
  const [authorized, setAuthorized] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AtlasAssistantUiState>('closed');
  const [error, setError] = useState('');
  const [providerError, setProviderError] = useState('');
  const [textCapability, setTextCapability] = useState<AtlasCapabilityState>('configuration-required');
  const [providerLabel, setProviderLabel] = useState('checking');
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

  const refreshProviderStatus = useCallback(async () => {
    setProviderLabel('checking');
    setTextCapability('configuration-required');
    try {
      const status = await getAssistantStatus();
      const mapped = providerCapability(status.provider_state);
      setTextCapability(mapped.capability);
      setProviderLabel(mapped.label);
      setProviderError(mapped.message);
    } catch (cause) {
      if (identityFailure(cause)) throw cause;
      const message = errorMessage(cause);
      if (errorCode(cause) === 'permission_denied') {
        setTextCapability('permission-required');
        setProviderLabel('permission required');
        setProviderError(message);
        return;
      }
      setTextCapability('unavailable');
      setProviderLabel('unavailable');
      setProviderError(message);
    }
  }, []);

  const refreshAuthorization = useCallback(async () => {
    try {
      await getActiveAtlasOrganization();
      setAuthorized(true);
      await refreshProviderStatus();
    } catch {
      voice.stopMicrophone();
      voice.stopSpeech();
      setAuthorized(false);
      setOpen(false);
      setState('closed');
      setProviderLabel('checking');
      setTextCapability('configuration-required');
      setProviderError('');
      setError('');
    }
  }, [refreshProviderStatus, voice.stopMicrophone, voice.stopSpeech]);

  useEffect(() => {
    void refreshAuthorization();
    const handleSession = () => void refreshAuthorization();
    window.addEventListener(ATLAS_SESSION_EVENT, handleSession);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSession);
  }, [refreshAuthorization]);

  useEffect(() => {
    if (!authorized || textCapability !== 'ready' || readGreetingSeen()) return;
    markGreetingSeen();
    setMessages((current) => current.length ? current : [{
      id: nextId('assistant'),
      role: 'assistant',
      text: GREETING
    }]);
  }, [authorized, nextId, textCapability]);

  if (!authorized) return null;

  async function submit(message: string) {
    if (textCapability !== 'ready') {
      setError(providerError || 'ATLAS Intelligence is not ready for requests.');
      setState('error');
      return;
    }
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
      if (identityFailure(cause)) {
        void refreshAuthorization();
      } else {
        void refreshProviderStatus();
      }
    }
  }

  async function toggleMicrophone() {
    setError(providerError);
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
    setError(providerError);
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
    voice.stopSpeech();
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
          textCapability={textCapability}
          providerLabel={providerLabel}
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
        <AtlasAssistantLauncher state={state} textCapability={textCapability} providerLabel={providerLabel} onOpen={openAssistant} />
      )}
    </div>
  );
}
