import { BrowserConnectStore } from '../../../../../packages/connect/storage';

export function PublicationsPage() {
  const state = new BrowserConnectStore(window.localStorage).read();

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect</p>
        <h1>Publications</h1>
        <p>Development-local publication status and verification receipts. This is not tenant-safe production storage.</p>
      </header>
      <div className="notice">Development local persistence — not tenant-safe production storage</div>

      {state.receipts.length === 0 ? (
        <div className="empty-state">
          <strong>No publication receipts yet</strong>
          <span>Opening a destination does not create a receipt. A manual confirmation or verified provider result is required.</span>
        </div>
      ) : (
        <div className="receipt-list">
          {state.receipts.map((receipt) => (
            <article className="feature-card wide" key={receipt.id}>
              <div className="card-heading">
                <span className="status-chip">Published</span>
                <span className="status-chip neutral">{receipt.verification.replaceAll('_', ' ')}</span>
              </div>
              <h2>{receipt.publicationId}</h2>
              <p>Fingerprint: {receipt.fingerprint}</p>
              <p>Recorded by {receipt.actor} at {receipt.createdAt}</p>
              {receipt.providerReference ? <p>Reference: {receipt.providerReference}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
