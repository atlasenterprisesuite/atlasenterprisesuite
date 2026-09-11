import { type FormEvent, useState } from 'react';
import type { AtlasAssistantMessage, AtlasAssistantUiState, AtlasCapabilityState } from '../../assistant/types';
import { AtlasAssistantMessageList } from './AtlasAssistantMessageList';

type AtlasAssistantPanelProps = {
  messages: AtlasAssistantMessage[];
  state: AtlasAssistantUiState;
  error: string;
  moduleLabel: string;
  microphoneCapability: AtlasCapabilityState;
  microphoneActive: boolean;
  speechCapability: AtlasCapabilityState;
  speechEnabled: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  onToggleMicrophone: () => Promise<void>;
  onSpeechPreference: (enabled: boolean) => void;
};

function stateLabel(state: AtlasAssistantUiState) {
  if (state === 'thinking') return 'Thinking';
  if (state === 'listening') return 'Listening';
  if (state === 'speaking') return 'Speaking';
  if (state === 'error') return 'Needs attention';
  return 'Ready';
}

export function AtlasAssistantPanel({
  messages,
  state,
  error,
  moduleLabel,
  microphoneCapability,
  microphoneActive,
  speechCapability,
  speechEnabled,
  onClose,
  onSubmit,
  onToggleMicrophone,
  onSpeechPreference
}: AtlasAssistantPanelProps) {
  const [input, setInput] = useState('');
  const busy = state === 'thinking' || state === 'speaking';
  const microphoneUnavailable = microphoneCapability === 'unavailable';
  const speechUnavailable = speechCapability !== 'ready';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || busy || microphoneActive) return;
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
            <small role="status" aria-live="polite">{stateLabel(state)}</small>
          </div>
        </div>
        <button type="button" className="atlas-assistant-close" aria-label="Close ATLAS Assistant" onClick={onClose}>×</button>
      </header>

      <AtlasAssistantMessageList messages={messages} />

      {error ? <div className="atlas-assistant-error" role="alert">{error}</div> : null}

      <div className="atlas-assistant-voice-controls" aria-label="ATLAS Assistant voice controls">
        <button
          type="button"
          onClick={() => void onToggleMicrophone()}
          disabled={microphoneUnavailable || state === 'thinking' || state === 'speaking'}
          aria-pressed={microphoneActive}
        >
          {microphoneUnavailable ? 'Microphone unavailable' : microphoneActive ? 'Stop microphone' : 'Enable microphone'}
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
        {microphoneActive ? <small role="status">Microphone capture is active. Voice transcription is not connected in this web milestone.</small> : null}
      </div>

      <form className="atlas-assistant-compose" onSubmit={handleSubmit}>
        <label htmlFor="atlas-assistant-input" className="sr-only">Message ATLAS Assistant</label>
        <textarea
          id="atlas-assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={microphoneActive ? 'Stop microphone capture to type' : 'Ask ATLAS…'}
          rows={2}
          disabled={busy || microphoneActive}
        />
        <button type="submit" disabled={busy || microphoneActive || !input.trim()}>{state === 'thinking' ? 'Thinking…' : 'Send'}</button>
      </form>
    </section>
  );
}
