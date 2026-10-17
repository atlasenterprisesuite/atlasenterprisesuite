import { useState } from 'react';
import { Link } from 'react-router-dom';

const capabilityRows = [
  ['Meeting transport', 'Not configured', 'No real-time meeting provider has been verified for this surface.'],
  ['Sign-language avatar', 'Not configured', 'A language-validated signing renderer is required before playback can be enabled.'],
  ['Live captions', 'Not configured', 'Only show live captions after a verified captioning service is connected.'],
  ['Human interpreter', 'Not configured', 'Escalation requires an authorized interpreter service and consent.'],
] as const;

export function ConnectMeetingsPage() {
  const [draft, setDraft] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'extra-large'>('large');
  const [position, setPosition] = useState<'inline' | 'side'>('inline');
  const [isPaused, setIsPaused] = useState(false);
  const fontSize = textSize === 'extra-large' ? '2rem' : textSize === 'large' ? '1.5rem' : '1rem';
  return (
    <section className="page-stack" aria-labelledby="atlas-meetings-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Inclusive Communication</p>
        <h1 id="atlas-meetings-title">Meetings & Sign Avatar</h1>
        <p>Accessible meetings with user-selected sign languages, captions and optional interpreter support. No media capture or interpretation starts on this page.</p>
      </header>
      <div className="notice" role="status">
        Preview of product capabilities only. A live meeting or sign-language interpretation is not currently active.
      </div>
      <div className="module-grid">
        {capabilityRows.map(([title, status, description]) => (
          <article className="module-card" key={title}>
            <span>{status}</span><strong>{title}</strong><p>{description}</p>
          </article>
        ))}
      </div>
      <section aria-labelledby="atlas-manual-captions-title">
        <h2 id="atlas-manual-captions-title">Manual communication display</h2>
        <p>Type a message to display readable text. This is NOT automatic speech recognition, translation or signing.</p>
        <label className="field" htmlFor="atlas-manual-message">
          <span>Message to display</span>
          <textarea id="atlas-manual-message" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={2000} />
        </label>
        <div className="row-actions">
          <button type="button" disabled={!draft.trim() || isPaused} onClick={() => setDisplayedText(draft.trim())}>Show message</button>
          <button type="button" onClick={() => setIsPaused((paused) => !paused)}>{isPaused ? 'Resume updates' : 'Pause updates'}</button>
          <button type="button" disabled={!displayedText} onClick={() => { setDisplayedText(''); setDraft(''); }}>Clear</button>
        </div>
        <div className="row-actions">
          <label className="field" htmlFor="atlas-caption-size"><span>Text size</span>
            <select id="atlas-caption-size" value={textSize} onChange={(event) => setTextSize(event.target.value as typeof textSize)}>
              <option value="normal">Normal</option><option value="large">Large</option><option value="extra-large">Extra large</option>
            </select>
          </label>
          <label className="field" htmlFor="atlas-caption-layout"><span>Layout preference</span>
            <select id="atlas-caption-layout" value={position} onChange={(event) => setPosition(event.target.value as typeof position)}>
              <option value="inline">Inline</option><option value="side">Wide reading panel</option>
            </select>
          </label>
        </div>
        <div role="region" aria-label="Manual message display" aria-live="polite" style={{ maxWidth: position === 'side' ? '60rem' : '40rem', padding: '1rem', border: '1px solid currentColor', borderRadius: '0.75rem', overflowWrap: 'anywhere' }}>
          <p style={{ fontSize, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{displayedText || 'Messages you choose to display will appear here.'}</p>
        </div>
        <p role="status">{isPaused ? 'Message updates paused. Current text remains visible.' : 'Ready for manual text.'}</p>
      </section>
      <section aria-labelledby="atlas-sign-workflow-title">
        <h2 id="atlas-sign-workflow-title">Accessible communication workflow</h2>
        <ol>
          <li>Select a sign language explicitly in your accessibility preferences. Spoken language and location must never be used to infer it.</li>
          <li>Connect a verified meeting and caption provider with participant consent.</li>
          <li>Enable a validated linguistic and animation pipeline for that sign language.</li>
          <li>Review captions and translation confidence; request an authorized human interpreter where needed.</li>
        </ol>
        <p>Signing requires facial expression, hand shape, movement and spatial grammar. Unvalidated gesture animations must never be presented as accurate sign-language interpretation.</p>
        <Link className="text-link" to="/settings/accessibility/communication">Configure communication accessibility</Link>
      </section>
      <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
    </section>
  );
}
