import { Link } from 'react-router-dom';

const capabilities = [
  ['Mobile service', 'eSIM-ready control plane', 'Primary wholesale carrier required for live activation'],
  ['Home internet', 'ATLAS Home Hub architecture', 'Managed by ATLAS Wireless; hardware / wholesale access required'],
  ['Satellite', 'Direct-to-device fallback architecture', 'Specialized partner only when the primary carrier does not provide it'],
  ['Plan', '$39 / month target', 'Commercial target — not offered until wholesale economics are verified'],
];

const launchGates = [
  'Primary wholesale carrier / MVNO agreement',
  'eSIM and provisioning',
  'Billing, telecom tax and compliance',
  '911 / E911 responsibility and validation',
  'ATLAS Home Hub supply and certification',
  'Satellite / D2D partner path when required',
  'End-to-end staging tests',
  'Exact-SHA production verification',
];

export function AtlasWirelessPage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless Department</p>
        <h1 id="atlas-wireless-title">ATLAS Wireless</h1>
        <p>One ATLAS department owns the customer connectivity experience across mobile, home and satellite paths. External providers are implementation dependencies, not separate ATLAS products.</p>
      </header>

      <div className="stat-grid" aria-label="ATLAS Wireless launch status">
        <article><strong>$39/mo</strong><span>target single-line price</span></article>
        <article><strong>Unlimited</strong><span>product target</span></article>
        <article><strong>One department</strong><span>mobile · home · satellite</span></article>
      </div>

      <div className="notice" role="status">
        Pre-launch architecture. ATLAS Wireless remains the single owner while a primary wholesale carrier is selected competitively. Carrier provisioning, billing, signal, satellite coverage and subscriber activation stay fail-closed until the relevant provider contracts and interfaces are verified.
      </div>

      <div className="module-grid">
        {capabilities.map(([title, value, note]) => (
          <article className="feature-card" key={title}>
            <p className="eyebrow">{title}</p>
            <h2>{value}</h2>
            <p>{note}</p>
          </article>
        ))}
      </div>

      <div className="module-grid compact">
        <article className="module-card disabled" aria-disabled="true"><span>Activation</span><strong>Provider-gated</strong><p>No activation is permitted without a verified MVNO/carrier interface.</p></article>
        <article className="module-card disabled" aria-disabled="true"><span>Billing</span><strong>Provider-gated</strong><p>No subscriber billing is represented as operational before commercial launch.</p></article>
        <article className="module-card disabled" aria-disabled="true"><span>Satellite</span><strong>Coverage-gated</strong><p>A specialized provider is used only where the primary carrier cannot contractually supply the required path.</p></article>
      </div>

      <article className="feature-card" aria-labelledby="wireless-gates-title">
        <p className="eyebrow">Single-department launch control</p>
        <h2 id="wireless-gates-title">ATLAS Wireless owns every gate</h2>
        <ol>
          {launchGates.map((gate) => <li key={gate}>{gate}</li>)}
        </ol>
        <p>Preferred commercial model: one primary wholesale carrier, with specialized providers added only where technically or contractually necessary.</p>
      </article>

      <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
    </section>
  );
}
