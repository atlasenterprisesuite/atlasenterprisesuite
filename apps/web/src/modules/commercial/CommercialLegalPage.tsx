import { Link } from 'react-router-dom';

const LEGAL_METADATA = {
  version: '2026-10-04-v1',
  effectiveDate: 'October 4, 2026',
  owner: 'ATLAS Enterprise Suite'
} as const;

export function CommercialLegalPage({ document }: { document: 'terms' | 'privacy' }) {
  const terms = document === 'terms';

  return (
    <main className="commercial-page page-stack">
      <header className="page-header commercial-hero">
        <p className="eyebrow">ATLAS Enterprise Suite · Legal surface</p>
        <h1>{terms ? 'ATLAS Terms of Service' : 'ATLAS Privacy Policy'}</h1>
        <p>
          {terms
            ? 'Versioned commercial terms for access to ATLAS products and services.'
            : 'Versioned privacy information describing the ATLAS data-handling boundary.'}
        </p>
      </header>

      <section className="feature-card commercial-legal-metadata" aria-label="Legal document metadata">
        <h2>Document control</h2>
        <p>Document version: {LEGAL_METADATA.version}</p>
        <p>Effective date: {LEGAL_METADATA.effectiveDate}</p>
        <p>Owner: {LEGAL_METADATA.owner}</p>
      </section>

      <section className="feature-card">
        <h2>{terms ? 'Commercial boundary' : 'Privacy boundary'}</h2>
        <p>
          {terms
            ? 'A signed order or contract controls customer-specific scope, commercial terms, support obligations, provider dependencies and accepted exceptions.'
            : 'Organization data, identity, permissions and provider connections remain scoped by the applicable ATLAS product contracts and verified technical controls.'}
        </p>
        <p className="commercial-boundary">
          External legal review evidence is required before the Commercial Release Gate can treat this legal document as release-ready.
          Publication of this page is not legal approval evidence.
        </p>
      </section>

      <nav className="commercial-actions" aria-label="Commercial legal navigation">
        <Link className="action-link" to={terms ? '/privacy' : '/terms'}>{terms ? 'Privacy Policy' : 'Terms of Service'}</Link>
        <Link className="action-link" to="/security">Security</Link>
      </nav>
    </main>
  );
}
