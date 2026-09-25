import { Link } from 'react-router-dom';

const lifecycle = [
  'Order',
  'Pending provider',
  'Provisioning',
  'Install eSIM',
  'Activate',
  'Test',
  'Suspend / reconnect',
  'Revoke',
  'Audit evidence',
];

const pilotChecks = [
  'Pilot accepted by wholesale carrier / MVNO',
  'Test SIM/eSIM + MSISDN issued',
  'Provisioning credentials stored outside source control',
  'Technical onboarding contact assigned',
  'Provision / activate / status / suspend / reconnect / revoke interfaces verified',
  'Voice, SMS/MMS, data and hotspot validated',
  'E911 responsibility and coordinated test procedure documented',
];

export function AtlasMvnoControlPage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-mvno-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless Department</p>
        <h1 id="atlas-mvno-title">ATLAS MVNO Control Plane</h1>
        <p>Provider-neutral subscriber lifecycle for ATLAS Wireless. Live activation remains fail-closed until an authorized wholesale carrier interface is verified.</p>
      </header>

      <div className="notice" role="status">
        Pilot state: pending_provider. No mock, fixture or static UI state can satisfy activation.
      </div>

      <div className="stat-grid" aria-label="MVNO pilot status">
        <article><strong>1</strong><span>internal pilot line target</span></article>
        <article><strong>Fail-closed</strong><span>provider state policy</span></article>
        <article><strong>Provider-neutral</strong><span>adapter contract</span></article>
      </div>

      <article className="feature-card">
        <p className="eyebrow">Subscriber lifecycle</p>
        <h2>End-to-end pilot path</h2>
        <ol>{lifecycle.map((step) => <li key={step}>{step}</li>)}</ol>
      </article>

      <article className="feature-card">
        <p className="eyebrow">Pilot gate</p>
        <h2>Evidence required before active</h2>
        <ul>{pilotChecks.map((check) => <li key={check}>{check}</li>)}</ul>
      </article>

      <Link className="text-link" to="/connect/wireless">Back to ATLAS Wireless</Link>
    </section>
  );
}
