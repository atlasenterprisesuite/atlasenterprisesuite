import { Link } from 'react-router-dom';
import { HospitalitySubnav } from './HospitalitySubnav';
import { getCachedHospitalityProperty } from './hospitalityContext';

export function HospitalityOverviewPage() {
  const selectedProperty = getCachedHospitalityProperty();

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality OS</p>
        <h1>Hospitality Overview</h1>
        <p>One governed operating surface for hotel and restaurant properties, built on ATLAS organization, identity, permission, audit, and execution boundaries.</p>
      </header>
      <HospitalitySubnav />

      <div className="feature-card wide">
        <p className="eyebrow">Property context</p>
        <h2>{selectedProperty?.propertyName || 'No property selected'}</h2>
        <p>{selectedProperty ? `Property ${selectedProperty.propertyId} is selected for this browser context. Authorization remains server-enforced.` : 'Select a verified property when a property catalog source is connected. Local context never grants authorization.'}</p>
        <Link className="text-link" to="/hospitality/properties">View properties</Link>
      </div>

      <div className="hospitality-status-grid">
        <article className="feature-card">
          <p className="eyebrow">Operational</p>
          <h2>Room Access</h2>
          <strong>Available foundation</strong>
          <p>Provider readiness, mappings, credential lifecycle, and audit evidence remain available under the existing governed access routes.</p>
          <Link className="text-link" to="/hospitality/access">Open Room Access</Link>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Foundation</p>
          <h2>Hotel Operations</h2>
          <strong>Core model ready</strong>
          <p>Property, outlet, space, scope, permission, and event contracts are established. PMS reservations, check-in/out, folios, housekeeping automation, and payments are not presented as live yet.</p>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Foundation</p>
          <h2>Restaurant Operations</h2>
          <strong>Core model ready</strong>
          <p>Restaurant outlets and table spaces are represented in the shared property model. POS, ordering, kitchen execution, refunds, and inventory mutations remain unavailable until real backends are integrated.</p>
        </article>
      </div>
    </section>
  );
}
