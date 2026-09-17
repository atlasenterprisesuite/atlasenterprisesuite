import { Link } from 'react-router-dom';

export function ConnectHomePage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-connect-title">
      <header className="page-header">
        <p className="eyebrow">Communications</p>
        <h1 id="atlas-connect-title">ATLAS Connect</h1>
        <p>Governed communications and carrier-provider connections. Provider capabilities remain explicitly gated until ATLAS can verify a supported integration path.</p>
      </header>

      <div className="module-grid">
        <Link className="module-card enabled" to="/connect/google-fi">
          <span>Wireless · External-gated</span>
          <strong>Google Fi Wireless</strong>
          <p>Open the official Google Fi account portal and stage statement files without representing private carrier APIs as connected.</p>
        </Link>
      </div>

      <div className="notice">ATLAS Connect does not store carrier passwords. A provider is never shown as live or connected unless an authorized, verifiable integration exists.</div>
    </section>
  );
}
