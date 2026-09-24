import { Link } from 'react-router-dom';

const capabilities = [
  ['Mobile service', 'eSIM-ready control plane', 'Provider contract required for live activation'],
  ['Home internet', 'ATLAS Home Hub architecture', 'Hardware / wholesale access required'],
  ['Satellite', 'Direct-to-device fallback architecture', 'Partner availability and device coverage apply'],
  ['Plan', '$39 / month target', 'Commercial target — not offered until wholesale economics are verified'],
];

export function AtlasWirelessPage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless</p>
        <h1 id="atlas-wireless-title">ATLAS Wireless</h1>
        <p>One connectivity experience across mobile, home and satellite paths, with provider capabilities fail-closed until an authorized carrier integration is verified.</p>
      </header>

      <div className="stat-grid" aria-label="ATLAS Wireless launch status">
        <article><strong>$39/mo</strong><span>target single-line price</span></article>
        <article><strong>Unlimited</strong><span>product target</span></article>
        <article><strong>eSIM + Hub</strong><span>planned access modes</span></article>
      </div>

      <div className="notice" role="status">
        Pre-launch architecture. ATLAS does not currently represent carrier provisioning, billing, signal, satellite coverage or subscriber activation as live. Those functions remain disabled until verified provider contracts and interfaces exist.
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
        <article className="module-card disabled" aria-disabled="true"><span>Satellite</span><strong>Coverage-gated</strong><p>Availability must be derived from an authorized partner and supported device.</p></article>
      </div>

      <div className="notice">
        Launch gates: wholesale carrier agreement → eSIM/provisioning integration → billing/tax/E911/compliance → Home Hub supply → satellite partner path → end-to-end tests → production verification.
      </div>

      <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
    </section>
  );
}
