import { Link } from 'react-router-dom';
import { ATLAS_NEWS_WHATSAPP_CHANNEL } from '../../../../../packages/connect/destinations';

export function WhatsAppChannelPage() {
  const destination = ATLAS_NEWS_WHATSAPP_CHANNEL;

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · WhatsApp Channel</p>
        <h1>{destination.name}</h1>
        <p>Official ATLAS news destination with capability truth separated from provider configuration.</p>
      </header>

      <div className="capability-banner warning">
        <strong>Manual handoff</strong>
        <span>Not automated — opening WhatsApp is not publication evidence.</span>
      </div>

      <div className="health-detail-grid">
        <article className="feature-card">
          <p className="eyebrow">Provider state</p>
          <strong>No verified Channel publishing provider</strong>
          <p>Peach remains a WhatsApp Business messaging integration and is not represented as a Channel publisher.</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Supported in this slice</p>
          <strong>{destination.supportedContentTypes.join(' · ')}</strong>
          <p>Audio and polls remain disabled until ATLAS has a validated authoring flow for them.</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Verification rule</p>
          <strong>Explicit confirmation required</strong>
          <p>A publication receipt is created only after an authorized human confirms the update was published.</p>
        </article>
      </div>

      <div className="action-row">
        <Link className="action-button" to="/studio/publish">Prepare an update</Link>
        <a className="text-link" href={destination.publicUrl} target="_blank" rel="noreferrer">Open public channel</a>
      </div>
    </section>
  );
}
