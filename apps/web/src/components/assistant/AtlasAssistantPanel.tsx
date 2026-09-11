import { type FormEvent, useState } from 'react';
import type { AtlasAssistantMessage, AtlasAssistantUiState } from '../../assistant/types';
import { AtlasAssistantMessageList } from './AtlasAssistantMessageList';

type AtlasAssistantPanelProps = {
  messages: AtlasAssistantMessage[];
  state: AtlasAssistantUiState;
  error: string;
  moduleLabel: string;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
};

function stateLabel(state: AtlasAssistantUiState) {
  if (state === 'thinking') return 'Thinking';
  if (state === 'listening') return 'Listening';
  if (state === 'speaking') return 'Speaking';
  if (state === 'error') return 'Needs attention';
  return 'Ready';
}

export function AtlasAssistantPanel({ messages, state, error, moduleLabel, onClose, onSubmit }: AtlasAssistantPanelProps) {
  const [input, setInput] = useState('');
  const busy = state === 'thinking' || state === 'listening' || state === 'speaking';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    if (!value || busy) return;
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

      <form className="atlas-assistant-compose" onSubmit={handleSubmit}>
        <label htmlFor="atlas-assistant-input" className="sr-only">Message ATLAS Assistant</label>
        <textarea
          id="atlas-assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask ATLAS…"
          rows={2}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>{state === 'thinking' ? 'Thinking…' : 'Send'}</button>
      </form>
    </section>
  );
}
