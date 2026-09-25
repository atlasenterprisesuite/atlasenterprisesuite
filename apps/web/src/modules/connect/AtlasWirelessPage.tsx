import { Link } from 'react-router-dom';

const capabilities = [
  ['Owned network', '5G/RAN control plane', 'ATLAS-owned infrastructure is governed separately from wholesale fallback'],
  ['Mobile service', 'eSIM-ready control plane', 'Activation remains gated by verified network/provider readiness'],
  ['Home internet', 'ATLAS Home Hub architecture', 'Managed by ATLAS Wireless; hardware / access required'],
  ['Satellite', 'Direct-to-device fallback architecture', 'Specialized path only where owned/primary access is unavailable'],
];

const launchGates = [
  'Owned-network core / RAN / spectrum / backhaul evidence',
  'eSIM and subscriber provisioning',
  'Billing, telecom tax and compliance',
  '911 / E911 responsibility and validation',
  'ATLAS Home Hub supply and certification',
  'Wholesale / satellite fallback when required',
  'End-to-end staging tests',
  'Exact-SHA production verification',
];

export function AtlasWirelessPage() {
  return (
    <section className="page-stack" aria-labelledby="atlas-wireless-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Wireless Department</p>
        <h1 id="atlas-wireless-title">ATLAS Wireless</h1>
        <p>ATLAS Wireless is the canonical service provider across owned, hybrid and wholesale-fallback network modes. Physical coverage and commercial readiness remain evidence-gated.</p>
      </header>

      <div className="stat-grid" aria-label="ATLAS Wireless launch status">
        <article><strong>ATLAS-owned</strong><span>target network path</span></article>
        <article><strong>Hybrid</strong><span>build-out transition mode</span></article>
        <article><strong>Fail-closed</strong><span>public activation policy</span></article>
      </div>

      <div className="notice" role="status">
        Pre-launch infrastructure. ATLAS does not treat configuration, ordered hardware, route reachability or branding as proof of a live radio network. Core, RAN, spectrum, backhaul, subscriber identity, emergency and commercial gates require authenticated evidence.
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

      <article className="feature-card" aria-labelledby="wireless-gates-title">
        <p className="eyebrow">Single-department launch control</p>
        <h2 id="wireless-gates-title">ATLAS Wireless owns every gate</h2>
        <ol>{launchGates.map((gate) => <li key={gate}>{gate}</li>)}</ol>
      </article>

      <div className="row-actions">
        <Link className="text-link" to="/connect/wireless/network">Open ATLAS-owned network control</Link>
        <Link className="text-link" to="/connect/wireless/mvno">Open MVNO / fallback control</Link>
        <Link className="text-link" to="/connect">Back to ATLAS Connect</Link>
      </div>
    </section>
  );
}
