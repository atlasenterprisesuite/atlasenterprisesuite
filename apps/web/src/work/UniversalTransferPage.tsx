import { WorkSubnav } from './WorkSubnav';

export function UniversalTransferPage() {
  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <div>
          <p className="eyebrow">ATLAS Universal Transfer</p>
          <h1>Bring. Upload. Share.</h1>
          <p>One governed transfer fabric for every ATLAS module. Identity, tenant scope, permissions, provenance and audit stay attached to every movement.</p>
        </div>
      </header>
      <div className="work-summary-grid" aria-label="Universal Transfer capabilities">
        <article className="work-summary-card"><span>Bring</span><strong>Import from approved connectors, URLs and ATLAS sources.</strong></article>
        <article className="work-summary-card"><span>Upload</span><strong>Receive device files into governed organization storage.</strong></article>
        <article className="work-summary-card"><span>Share</span><strong>Grant controlled, revocable and expiring access.</strong></article>
      </div>
      <section className="execution-panel">
        <p className="eyebrow">Zero Trust boundary</p>
        <h2>No silent movement of data</h2>
        <p>External sources require verified provider sessions. Public links require elevated permission and expiration. State-changing transfer operations remain organization-bound and auditable.</p>
      </section>
    </section>
  );
}
