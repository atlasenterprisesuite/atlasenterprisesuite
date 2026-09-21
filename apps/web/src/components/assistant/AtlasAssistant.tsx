import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  assistantProviderSummary,
  getAssistantStatus,
  hasVerifiedAssistantProvider,
  sendAssistantMessage,
  type AssistantStatusResponse
} from '../../assistant/client';
import { enqueueAssistantRepair, getAssistantRepairs, type AssistantRepairJob } from '../../assistant/repairClient';
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
  if (code === 'owner_or_admin_required') return 'Only an ATLAS owner or admin can queue a repair.';
  if (code === 'repair_request_required') return 'Describe the detail that ATLAS should repair.';
  if (code === 'server_secret_not_configured' || code === 'storage_not_configured') return 'The governed repair service is not configured in this environment.';
  if (code === 'provider_not_configured') return 'ATLAS Intelligence is not configured for this environment.';
  if (code === 'provider_rate_limited') return 'ATLAS Intelligence is temporarily rate limited. Try again shortly.';
  if (code === 'provider_unavailable') return 'ATLAS Intelligence is temporarily unavailable.';
  if (code === 'emergency_budget_exhausted') return 'ATLAS emergency OpenAI fallback reached its configured spending limit.';
  if (code === 'emergency_budget_unavailable') return 'ATLAS emergency fallback budget control is unavailable, so paid fallback was blocked.';
  if (code === 'microphone_permission_denied') return 'Microphone permission was denied. Text mode remains available.';
  if (code === 'microphone_unsupported' || code === 'microphone_unavailable') return 'Microphone capture is unavailable. Text mode remains available.';
  if (code === 'speech_unavailable') return 'Speech output is unavailable. The assistant reply remains available as text.';
  if (code === 'voice_no_speech') return 'ATLAS did not hear a complete phrase. Try again.';
  if (code === 'voice_transcription_unavailable') return 'Voice transcription is unavailable in this browser. Text mode remains available.';
  if (code === 'voice_transcription_failed') return 'ATLAS could not transcribe that voice turn. Try again or use text.';
  return 'ATLAS Assistant could not complete that request.';
}

function providerCapability(status: AssistantStatusResponse): { capability: AtlasCapabilityState; label: string; message: string } {
  if (hasVerifiedAssistantProvider(status)) {
    return { capability: 'ready', label: `${assistantProviderSummary(status)} ready`, message: '' };
  }

  const states = status.providers?.map((provider) => provider.state) || [];
  const configurationOnly = states.length > 0 && states.every((state) => state === 'configuration-required');
  const legacyConfigurationOnly = states.length === 0
    && (status.provider_state === 'not_configured' || status.provider_state === 'configured_unverified');
  if (configurationOnly || legacyConfigurationOnly) {
    return {
      capability: 'configuration-required',
      label: 'configuration required',
      message: 'ATLAS Intelligence has no verified provider for requests in this environment.'
    };
  }

  return { capability: 'unavailable', label: 'unavailable', message: 'ATLAS Intelligence has no verified provider available right now.' };
}

type RepairSummary = { active: number; failed: number; completed: number; total: number };

function summarizeRepairJobs(jobs: AssistantRepairJob[]): RepairSummary {
  return jobs.reduce<RepairSummary>((summary, job) => {
    const status = String(job.status || '').toLowerCase();
    summary.total += 1;
    if (status === 'failed') summary.failed += 1;
    else if (status === 'completed') summary.completed += 1;
    else summary.active += 1;
    return summary;
  }, { active: 0, failed: 0, completed: 0, total: 0 });
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
  const [repairSummary, setRepairSummary] = useState<RepairSummary>({ active: 0, failed: 0, completed: 0, total: 0 });
  const sequence = useRef(0);
  const greetingSpoken = useRef(false);
  const moduleName = useMemo(() => resolveAssistantModule(location.pathname), [location.pathname]);
  const voice = useAssistantVoice();

  const nextId = useCallback((role: 'assistant' | 'user') => {
    sequence.current += 1;
    return `${role}-${sequence.current}`;
  }, []);

  const refreshProviderStatus = useCallback(async () => {
    try {
      const status = await getAssistantStatus();
      const mapped = providerCapability(status);
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

  const refreshRepairSummary = useCallback(async () => {
    try {
      const response = await getAssistantRepairs();
      setRepairSummary(summarizeRepairJobs(Array.isArray(response.jobs) ? response.jobs : []));
    } catch {
      // Passive status refresh must never block chat or repair submission.
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
    if (!authorized || textCapability === 'ready' || textCapability === 'permission-required') return;
    const timer = window.setInterval(() => {
      void refreshProviderStatus().catch(() => void refreshAuthorization());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [authorized, refreshAuthorization, refreshProviderStatus, textCapability]);

  useEffect(() => {
    if (!authorized || !open) return;
    void refreshRepairSummary();
    const timer = window.setInterval(() => void refreshRepairSummary(), 15_000);
    return () => window.clearInterval(timer);
  }, [authorized, open, refreshRepairSummary]);

  useEffect(() => {
    if (!authorized || textCapability !== 'ready' || readGreetingSeen()) return;
    markGreetingSeen();
    setMessages((current) => current.length ? current : [{
      id: nextId('assistant'),
      role: 'assistant',
      text: GREETING
    }]);

    if (!greetingSpoken.current && voice.speechEnabled && voice.speechCapability === 'ready') {
      greetingSpoken.current = true;
      setState('speaking');
      void voice.speak(GREETING).then(() => {
        setState(open ? 'idle' : 'closed');
      }).catch((cause) => {
        setError(errorMessage(cause));
        setState(open ? 'error' : 'closed');
      });
    }
  }, [authorized, nextId, open, textCapability, voice.speak, voice.speechCapability, voice.speechEnabled]);

  if (!authorized) return null;

  async function submit(message: string, modality: 'text' | 'voice' = 'text') {
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
        modality
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

  async function queueRepair(message: string) {
    if (voice.microphoneActive) voice.stopMicrophone();
    setError('');
    setState('thinking');
    setMessages((current) => [...current, { id: nextId('user'), role: 'user', text: message }]);

    try {
      const response = await enqueueAssistantRepair({
        message,
        pathname: location.pathname,
        conversationId
      });
      const jobId = response.job?.id ? ` ${response.job.id}` : '';
      setMessages((current) => [...current, {
        id: nextId('assistant'),
        role: 'assistant',
        text: `Repair task${jobId} queued securely. ATLAS attached this route and safe structural screen context to the governed repair path.`
      }]);
      void refreshRepairSummary();
      setState('idle');
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
      if (identityFailure(cause)) void refreshAuthorization();
    }
  }

  async function showRepairQueue() {
    if (voice.microphoneActive) voice.stopMicrophone();
    setError('');
    setState('thinking');

    try {
      const response = await getAssistantRepairs();
      const allJobs = Array.isArray(response.jobs) ? response.jobs : [];
      setRepairSummary(summarizeRepairJobs(allJobs));
      const jobs = allJobs.slice(0, 5);
      const text = jobs.length
        ? ['Recent repair tasks:', ...jobs.map((job) => {
            const status = String(job.status || 'unknown').toUpperCase();
            const request = String(job.request_text || 'Repair task').replace(/\s+/g, ' ').trim().slice(0, 96);
            const id = job.id ? ` · ${job.id}` : '';
            return `• ${status} — ${request}${id}`;
          })].join('\n')
        : 'There are no repair tasks for the active ATLAS organization.';
      setMessages((current) => [...current, {
        id: nextId('assistant'),
        role: 'assistant',
        text
      }]);
      setState('idle');
    } catch (cause) {
      setError(errorMessage(cause));
      setState('error');
      if (identityFailure(cause)) void refreshAuthorization();
    }
  }

  async function toggleMicrophone() {
    setError(providerError);
    if (voice.microphoneActive) {
      voice.stopMicrophone();
      setState('idle');
      return;
    }

    if (textCapability !== 'ready') {
      setError(providerError || 'ATLAS Intelligence is not ready for voice requests.');
      setState('error');
      return;
    }

    try {
      await voice.startVoiceTurn(
        (transcript) => {
          setState('thinking');
          void submit(transcript, 'voice');
        },
        (cause) => {
          setError(errorMessage(cause));
          setState('error');
        }
      );
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
    void refreshProviderStatus().catch(() => void refreshAuthorization());

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
          repairSummary={repairSummary}
          microphoneCapability={voice.microphoneCapability}
          transcriptionCapability={voice.transcriptionCapability}
          microphoneActive={voice.microphoneActive}
          speechCapability={voice.speechCapability}
          speechEnabled={voice.speechEnabled}
          onClose={closeAssistant}
          onSubmit={submit}
          onRepair={queueRepair}
          onShowRepairs={showRepairQueue}
          onToggleMicrophone={toggleMicrophone}
          onSpeechPreference={voice.setSpeechEnabled}
        />
      ) : (
        <AtlasAssistantLauncher state={state} textCapability={textCapability} providerLabel={providerLabel} onOpen={openAssistant} />
      )}
    </div>
  );
}
