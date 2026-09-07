import { Link } from 'react-router-dom';

export function ConnectHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect</p>
        <h1>ATLAS Connect</h1>
        <p>Govern destinations, publication capability, receipts, and delivery truth across ATLAS.</p>
      </header>
      <div className="module-grid">
        <Link className="module-card enabled" to="/connect/destinations">
          <span>Channels</span>
          <strong>Destinations</strong>
          <p>See exactly which publishing paths are available, manual, automated, or unavailable.</p>
        </Link>
        <Link className="module-card enabled" to="/connect/publications">
          <span>Evidence</span>
          <strong>Publications</strong>
          <p>Review local development publication status, receipts, and verification type.</p>
        </Link>
      </div>
    </section>
  );
}
