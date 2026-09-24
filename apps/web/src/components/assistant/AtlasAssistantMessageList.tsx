import type { AtlasAssistantMessage } from '../../assistant/types';

export function AtlasAssistantMessageList({ messages }: { messages: AtlasAssistantMessage[] }) {
  return (
    <div className="atlas-assistant-messages" aria-live="polite" aria-label="ATLAS Assistant conversation">
      {messages.length === 0 ? (
        <div className="atlas-assistant-empty">
          <strong>ATLAS Assistant</strong>
          <span>Ask a question about the ATLAS workspace you are using.</span>
        </div>
      ) : messages.map((message) => (
        <article key={message.id} className={`atlas-assistant-message ${message.role}`}>
          <span>{message.role === 'assistant' ? 'ATLAS' : 'You'}</span>
          <p>{message.text}</p>
        </article>
      ))}
    </div>
  );
}
