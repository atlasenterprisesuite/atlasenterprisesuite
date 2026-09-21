import { type FormEvent, useState } from 'react';
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
  repairSummary: { active: number; failed: number; completed: number; total: number };
  selectedElementLabel: string | null;
  selectingElement: boolean;
  microphoneCapability: AtlasCapabilityState;
  transcriptionCapability: AtlasCapabilityState;
  microphoneActive: boolean;
  speechCapability: AtlasCapabilityState;
  speechEnabled: boolean;
  onClose: () => void;
  onSubmit: (message: string, includeSelected?: boolean) => Promise<void>;
  onRepair: (message: string, includeSelected?: boolean) => Promise<void>;
  onShowRepairs: () => Promise<void>;
  onSelectElement: () => void;
  onClearElement: () => void;
  onToggleMicrophone: () => Promise<void>;
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
  repairSummary,
  selectedElementLabel,
  selectingElement,
  microphoneCapability,
  transcriptionCapability,
  microphoneActive,
  speechCapability,
  speechEnabled,
  onClose,
  onSubmit,
  onRepair,
  onShowRepairs,
  onSelectElement,
  onClearElement,
  onToggleMicrophone,
  onSpeechPreference
}: AtlasAssistantPanelProps) {
  const [input, setInput] = useState('');
  const busy = state === 'thinking' || state === 'speaking';
  const textReady = textCapability === 'ready';
  const microphoneUnavailable = microphoneCapability === 'unavailable';
  const transcriptionUnavailable = transcriptionCapability !== 'ready';
  const speechUnavailable = speechCapability !== 'ready';
  const explainScreenPrompt = 'Explain the current ATLAS screen, what each visible section is for, and what I can do here.';
  const checkScreenPrompt = 'Review the current ATLAS screen for visible UX, workflow, navigation, loading, error, empty-state, responsive, or accessibility problems. Report only issues supported by the current structural context.';
  const repairScreenPrompt = 'Inspect and repair verified defects on the current ATLAS screen: clipped or broken responsive UI, nonfunctional controls, route/navigation defects, loading/error/empty-state problems, and accessibility regressions. Preserve existing working functionality, tenant isolation, RBAC, auditability, and fail-closed production gates.';
  const explainSelectedPrompt = 'Explain the selected ATLAS element, what it does, how it relates to this screen, and any relevant state or permission behavior. Use the selected structural fingerprint and do not infer private field or table values.';
  const repairSelectedPrompt = 'Inspect and repair verified defects affecting the selected ATLAS element. Use its structural fingerprint to localize the component, preserve working behavior, tenant isolation, RBAC, auditability, and fail-closed production gates. Do not infer or capture private field or table values.';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || busy || microphoneActive || !textReady) return;
    setInput('');
    await onSubmit(value);
  }

  async function handleRepair() {
    const value = input.trim();
    if (!value || busy || microphoneActive) return;
    setInput('');
    await onRepair(value);
  }

  async function handleQuickAsk(message: string, includeSelected = false) {
    if (busy || microphoneActive || !textReady) return;
    await onSubmit(message, includeSelected);
  }

  async function handleScreenRepair() {
    if (busy || microphoneActive) return;
    await onRepair(repairScreenPrompt, false);
  }

  async function handleSelectedRepair() {
    if (busy || microphoneActive || !selectedElementLabel) return;
    await onRepair(repairSelectedPrompt, true);
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

      <div className="atlas-assistant-quick-actions" aria-label="ATLAS Assistant current screen actions">
        <div className="atlas-assistant-context-row">
          <span className="atlas-assistant-context-chip">Current screen · safe structural context</span>
          <span className={`atlas-assistant-repair-status ${repairSummary.failed > 0 ? 'has-failures' : repairSummary.active > 0 ? 'has-active' : ''}`} role="status" aria-live="polite">
            Repairs · {repairSummary.active} active · {repairSummary.failed} failed
          </span>
        </div>
        <div>
          <button type="button" onClick={() => void handleQuickAsk(explainScreenPrompt, false)} disabled={busy || microphoneActive || !textReady}>Explain screen</button>
          <button type="button" onClick={() => void handleQuickAsk(checkScreenPrompt, false)} disabled={busy || microphoneActive || !textReady}>Check screen</button>
          <button type="button" className="repair" onClick={() => void handleScreenRepair()} disabled={busy || microphoneActive}>Repair this screen</button>
          <button type="button" onClick={selectingElement ? onClearElement : onSelectElement} disabled={busy || microphoneActive}>{selectingElement ? 'Cancel selection' : selectedElementLabel ? 'Change element' : 'Select element'}</button>
          <button type="button" onClick={() => void onShowRepairs()} disabled={busy || microphoneActive}>Repair queue</button>
        </div>
        {selectedElementLabel ? (
          <div className="atlas-assistant-selected-target">
            <span>Selected · {selectedElementLabel}</span>
            <div>
              <button type="button" onClick={() => void handleQuickAsk(explainSelectedPrompt, true)} disabled={busy || microphoneActive || !textReady}>Explain selected</button>
              <button type="button" className="repair" onClick={() => void handleSelectedRepair()} disabled={busy || microphoneActive}>Repair selected</button>
              <button type="button" onClick={onClearElement} disabled={busy || microphoneActive}>Clear</button>
            </div>
          </div>
        ) : null}
      </div>

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
          placeholder={microphoneActive ? 'Finish or cancel the voice turn to type' : textReady ? 'Ask ATLAS or describe something to repair…' : 'Describe something to repair…'}
          rows={2}
          disabled={busy || microphoneActive}
        />
        <div className="atlas-assistant-compose-actions">
          <button type="submit" disabled={busy || microphoneActive || !textReady || !input.trim()}>{state === 'thinking' ? 'Thinking…' : 'Send'}</button>
          <button type="button" className="atlas-assistant-repair" onClick={() => void handleRepair()} disabled={busy || microphoneActive || !input.trim()}>{state === 'thinking' ? 'Working…' : 'Queue repair'}</button>
        </div>
        <small className="atlas-assistant-repair-note">Repair attaches route and structural screen context only. Form values and table contents are not captured.</small>
      </form>
    </section>
  );
}
