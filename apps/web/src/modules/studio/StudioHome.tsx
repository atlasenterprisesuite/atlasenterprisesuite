import { Link } from 'react-router-dom';

export function StudioHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Creator Studio</p>
        <h1>Creator Studio</h1>
        <p>Prepare governed public content and hand it to verified ATLAS Connect destinations.</p>
      </header>
      <div className="module-grid">
        <Link className="module-card enabled" to="/studio/publish">
          <span>Publishing</span>
          <strong>Compose & Publish</strong>
          <p>Prepare content, validate destination readiness, review the exact payload, and record delivery evidence.</p>
        </Link>
      </div>
      <div className="notice">External publication is capability-gated. A configured destination is not automatically a live publishing connection.</div>
    </section>
  );
}
