import { Link } from 'react-router-dom';

export function CommercialLeadPage({ intent }: { intent: 'request-demo' | 'contact' }) {
  const demo = intent === 'request-demo';

  return (
    <main className="commercial-page page-stack">
      <header className="page-header commercial-hero">
        <p className="eyebrow">ATLAS Enterprise Suite · Commercial access</p>
        <h1>{demo ? 'Request an ATLAS demo' : 'Contact ATLAS'}</h1>
        <p>
          {demo
            ? 'Start a governed evaluation of ATLAS for your organization, scope and operating requirements.'
            : 'Reach the ATLAS commercial team for product, implementation, security and enterprise-scope questions.'}
        </p>
      </header>

      <article className="feature-card commercial-lead-boundary">
        <p className="eyebrow">Evidence-first intake</p>
        <h2>No request is treated as recorded without a server reference.</h2>
        <p>
          The public commercial intake uses a bounded ATLAS server path. Until that path returns a reference,
          this page does not claim a lead, customer, order, payment or provisioning event exists.
        </p>
        <div className="commercial-actions">
          <Link className="action-link" to="/pricing">Review pricing</Link>
          <Link className="action-link" to="/security">Review security</Link>
        </div>
      </article>
    </main>
  );
}
