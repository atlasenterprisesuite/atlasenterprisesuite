import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { sendAssistantMessage } from '../../assistant/client';
import { resolveAssistantModule } from '../../assistant/routeContext';
import { markGreetingSeen, readGreetingSeen } from '../../assistant/storage';
import type { AtlasAssistantMessage, AtlasAssistantUiState } from '../../assistant/types';
import { ATLAS_SESSION_EVENT, getActiveAtlasOrganization } from '../../lib/atlasSession';
import { AtlasAssistantLauncher } from './AtlasAssistantLauncher';
import { AtlasAssistantPanel } from './AtlasAssistantPanel';
import './assistant.css';

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
  const moduleName = useMemo(() => resolveAssistantModule(location.pathname), [location.pathname]);

  const nextId = useCallback((role: 'assistant' | 'user') => {
    sequence.current += 1;
    return `${role}-${sequence.current}`;
  }, []);

  const refreshAuthorization = useCallback(async () => {
    try {
      await getActiveAtlasOrganization();
      setAuthorized(true);
    } catch {
      setAuthorized(false);
      setOpen(false);
      setState('closed');
    }
  }, []);

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
      text: 'ATLAS Assistant is ready. How can I help in this workspace?'
    }]);
  }, [authorized, nextId]);

  if (!authorized) return null;

  async function submit(message: string) {
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
      setState('idle');
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
    }
  }

  function openAssistant() {
    setOpen(true);
    setState('idle');
    setError('');
  }

  function closeAssistant() {
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
          onClose={closeAssistant}
          onSubmit={submit}
        />
      ) : (
        <AtlasAssistantLauncher state={state} onOpen={openAssistant} />
      )}
    </div>
  );
}
