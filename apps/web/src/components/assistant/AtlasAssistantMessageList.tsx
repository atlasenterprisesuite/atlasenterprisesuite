import { useEffect, useRef } from 'react';
import type { AtlasAssistantMessage } from '../../assistant/types';

export function AtlasAssistantMessageList({ messages }: { messages: AtlasAssistantMessage[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = container.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);
  return (
    <div ref={container} className="atlas-assistant-messages" aria-live="polite" aria-label="ATLAS Assistant conversation">
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
