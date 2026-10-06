import { Link } from 'react-router-dom';

export function CommercialSecurityPage() {
  return (
    <main className="commercial-page page-stack">
      <header className="page-header commercial-hero">
        <p className="eyebrow">ATLAS Enterprise Suite · Trust</p>
        <h1>ATLAS Security</h1>
        <p>
          Security claims are limited to controls that ATLAS can verify. Provider authorization, regulated operations,
          external attestations and customer-specific requirements remain separate evidence gates.
        </p>
      </header>

      <section className="commercial-trust-grid" aria-label="ATLAS security boundaries">
        <article className="feature-card">
          <h2>Identity and tenant scope</h2>
          <p>Organization membership, permissions and row-level boundaries protect governed operational data.</p>
        </article>
        <article className="feature-card">
          <h2>Release evidence</h2>
          <p>Production claims require exact-SHA deployment and fail-closed route verification rather than UI state.</p>
        </article>
        <article className="feature-card">
          <h2>External providers</h2>
          <p>Provider-backed capabilities remain unavailable until authorization, scopes and runtime evidence pass their own gates.</p>
        </article>
        <article className="feature-card">
          <h2>Auditability</h2>
          <p>Release and governance evidence is retained through ATLAS evidence and audit contracts instead of mutable status labels.</p>
        </article>
      </section>

      <div className="notice strong">
        This public trust surface does not assert an external certification, financial charter, telecommunications authority,
        clinical authorization or other regulated status without current supporting evidence.
      </div>

      <div className="commercial-actions">
        <Link className="action-link" to="/terms">Terms of Service</Link>
        <Link className="action-link" to="/privacy">Privacy Policy</Link>
        <Link className="action-link" to="/request-demo">Request a demo</Link>
      </div>
    </main>
  );
}
