import { Link } from 'react-router-dom';

const capabilityRows = [
  ['Meeting transport', 'Not configured', 'No real-time meeting provider has been verified for this surface.'],
  ['Sign-language avatar', 'Not configured', 'A language-validated signing renderer is required before playback can be enabled.'],
  ['Live captions', 'Not configured', 'Only show live captions after a verified captioning service is connected.'],
  ['Human interpreter', 'Not configured', 'Escalation requires an authorized interpreter service and consent.'],
] as const;

export function ConnectMeetingsPage() {
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
