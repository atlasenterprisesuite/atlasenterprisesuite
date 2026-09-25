import { type FormEvent, useState } from 'react';
import type { AtlasInternalControlSnapshot } from '../../assistant/internalControl';
import type { AtlasAssistantMessage, AtlasAssistantUiState, AtlasCapabilityState } from '../../assistant/types';
import { AtlasAssistantMessageList } from './AtlasAssistantMessageList';
import './assistantVoice.css';

type AtlasAssistantPanelProps = {
  messages: AtlasAssistantMessage[];
  state: AtlasAssistantUiState;
  error: string;
  moduleLabel: string;
  textCapability: AtlasCapabilityState;
  providerLabel: string;
  microphoneCapability: AtlasCapabilityState;
  transcriptionCapability: AtlasCapabilityState;
  microphoneActive: boolean;
  speechCapability: AtlasCapabilityState;
  speechEnabled: boolean;
  assistantRole: string | null;
  internalControl: AtlasInternalControlSnapshot | null;
  repairJobs: Array<{ id: string; request_text: string; status: string }>;
  internalLoading: boolean;
  internalError: string;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  onToggleMicrophone: () => Promise<void>;
  onRefreshInternal: () => Promise<void>;
  onQueueRepair: (request: string) => Promise<void>;
  onNavigate: (target: string) => void;
  onSpeechPreference: (enabled: boolean) => void;
};

function stateLabel(state: AtlasAssistantUiState) {
  if (state === 'thinking') return 'Thinking';
  if (state === 'listening') return 'Listening';
  if (state === 'speaking') return 'Speaking';
  if (state === 'error') return 'Needs attention';
  return 'Idle';
}

export function AtlasAssistantPanel({
  messages,
  state,
  error,
  moduleLabel,
  textCapability,
  providerLabel,
  microphoneCapability,
  transcriptionCapability,
  microphoneActive,
  speechCapability,
  speechEnabled,
  assistantRole,
  internalControl,
  repairJobs,
  internalLoading,
  internalError,
  onClose,
  onSubmit,
  onToggleMicrophone,
  onRefreshInternal,
  onQueueRepair,
  onNavigate,
  onSpeechPreference
}: AtlasAssistantPanelProps) {
  const [input, setInput] = useState('');
  const [internalOpen, setInternalOpen] = useState(false);
  const [repairInput, setRepairInput] = useState('');
  const busy = state === 'thinking' || state === 'speaking';
  const textReady = textCapability === 'ready';
  const microphoneUnavailable = microphoneCapability === 'unavailable';
  const transcriptionUnavailable = transcriptionCapability !== 'ready';
  const speechUnavailable = speechCapability !== 'ready';

  async function handleRepair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = repairInput.trim();
    if (!value || internalLoading) return;
    setRepairInput('');
    await onQueueRepair(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || busy || microphoneActive || !textReady) return;
    setInput('');
    await onSubmit(value);
  }

  return (
    <section className="atlas-assistant-panel" aria-label="ATLAS Assistant">
      <header className="atlas-assistant-header">
        <div className="atlas-assistant-identity">
          <img src="/atlas/assistant/atlas-assistant-avatar.png" alt="" />
          <div>
            <span className="eyebrow">ATLAS Assistant</span>
            <strong>{moduleLabel}</strong>
            <small role="status" aria-live="polite">{stateLabel(state)} · Intelligence {providerLabel}</small>
          </div>
        </div>
        <button type="button" className="atlas-assistant-close" aria-label="Close ATLAS Assistant" onClick={onClose}>×</button>
      </header>

      {['owner', 'admin', 'platform_admin'].includes(String(assistantRole || '')) ? (
        <section className="atlas-assistant-internal" aria-label="ATLAS internal controls">
          <div className="atlas-assistant-internal-bar">
            <button type="button" onClick={() => setInternalOpen((value) => !value)} aria-expanded={internalOpen}>
              Internal control
            </button>
            <span className={`atlas-assistant-readiness readiness-${internalControl?.productionReadiness || 'unknown'}`}>
              {internalLoading ? 'Checking…' : internalControl?.productionReadiness || 'Unknown'}
            </span>
          </div>

          {internalOpen ? (
            <div className="atlas-assistant-internal-body">
              <div className="atlas-assistant-quick-actions">
                <button type="button" onClick={() => onNavigate('/automations')}>Automations</button>
                <button type="button" onClick={() => onNavigate('/work/connections')}>My accounts</button>
                <button type="button" onClick={() => onNavigate('/execution/manager/readiness')}>System health</button>
                <button type="button" onClick={() => void onRefreshInternal()} disabled={internalLoading}>Refresh</button>
              </div>

              <div className="atlas-assistant-account-strip">
                <strong>Connected accounts</strong>
                {internalControl?.connections?.length ? (
                  <div>
                    {internalControl.connections.slice(0, 8).map((connection) => (
                      <span key={connection.id} className={`connection-${connection.status}`}>
                        {connection.provider} · {connection.status}
                      </span>
                    ))}
                  </div>
                ) : <small>No authorized account references are registered for this organization.</small>}
              </div>

              {internalControl?.blockers?.length ? (
                <div className="atlas-assistant-blockers">
                  <strong>Internal blockers</strong>
                  {internalControl.blockers.slice(0, 4).map((blocker) => (
                    <button
                      type="button"
                      key={`${blocker.stage}:${blocker.code}`}
                      onClick={() => setRepairInput(`Repair ${blocker.stage}: ${blocker.code}. ${blocker.detail}`)}
                    >
                      <span>{blocker.stage}</span>
                      <small>{blocker.code}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              {['owner', 'admin'].includes(String(assistantRole || '')) ? (
                <form className="atlas-assistant-repair" onSubmit={handleRepair}>
                  <label htmlFor="atlas-assistant-repair-input">Internal repair request</label>
                  <div>
                    <input
                      id="atlas-assistant-repair-input"
                      value={repairInput}
                      maxLength={12000}
                      onChange={(event) => setRepairInput(event.target.value)}
                      placeholder="Describe what ATLAS should diagnose and repair"
                    />
                    <button type="submit" disabled={internalLoading || !repairInput.trim()}>
                      {internalLoading ? 'Working…' : 'Queue repair'}
                    </button>
                  </div>
                  <small>Runs through the governed ATLAS repair queue. Provider, secret, destructive and production-sensitive changes stay fail-closed.</small>
                </form>
              ) : (
                <small className="atlas-assistant-internal-note">Platform-admin view is read-only for the repair queue; owner/admin is required to enqueue repairs.</small>
              )}

              {repairJobs.length ? (
                <div className="atlas-assistant-repair-jobs">
                  <strong>Recent repairs</strong>
                  {repairJobs.slice(0, 4).map((job) => (
                    <div key={job.id}>
                      <span>{job.request_text}</span>
                      <small>{job.status}</small>
                    </div>
                  ))}
                </div>
              ) : null}

              {internalError ? <div className="atlas-assistant-internal-error" role="status">{internalError}</div> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <AtlasAssistantMessageList messages={messages} />

      {error ? <div className="atlas-assistant-error" role="alert">{error}</div> : null}

      <div className="atlas-assistant-voice-controls" aria-label="ATLAS Assistant voice controls">
        <button
          type="button"
          onClick={() => void onToggleMicrophone()}
          disabled={microphoneUnavailable || transcriptionUnavailable || !textReady || state === 'thinking' || state === 'speaking'}
          aria-pressed={microphoneActive}
        >
          {microphoneUnavailable ? 'Microphone unavailable' : transcriptionUnavailable ? 'Voice transcription unavailable' : microphoneActive ? 'Cancel listening' : 'Speak to ATLAS'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={speechEnabled && !speechUnavailable}
            disabled={speechUnavailable}
            onChange={(event) => onSpeechPreference(event.target.checked)}
          />
          <span>{speechUnavailable ? 'Speech unavailable' : 'Speak replies'}</span>
        </label>
        <small>{transcriptionUnavailable ? 'This browser does not expose compatible speech recognition. Text mode remains available.' : microphoneActive ? 'ATLAS is listening for one user turn. Your final transcript will be sent to the governed assistant.' : 'Voice turns are transcribed in the browser, then sent through the same authenticated ATLAS Intelligence path as text.'}</small>
      </div>

      <form className="atlas-assistant-compose" onSubmit={handleSubmit}>
        <label htmlFor="atlas-assistant-input" className="sr-only">Message ATLAS Assistant</label>
        <textarea
          id="atlas-assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={!textReady ? `Intelligence ${providerLabel}` : microphoneActive ? 'Finish or cancel the voice turn to type' : 'Ask ATLAS…'}
          rows={2}
          disabled={busy || microphoneActive || !textReady}
        />
        <button type="submit" disabled={busy || microphoneActive || !textReady || !input.trim()}>{state === 'thinking' ? 'Thinking…' : 'Send'}</button>
      </form>
    </section>
  );
}
