import { Link } from 'react-router-dom';
import { HospitalitySubnav } from './HospitalitySubnav';
import { getCachedHospitalityProperty } from './hospitalityContext';

export function PropertiesPage() {
  const selectedProperty = getCachedHospitalityProperty();

  return (
    <section className="page-stack hospitality-access">
      <header className="page-header">
        <p className="eyebrow">ATLAS Hospitality OS</p>
        <h1>Properties</h1>
        <p>Multi-brand and multi-property operating scope. This surface stays read-only until a verified tenant-scoped property source is connected.</p>
      </header>
      <HospitalitySubnav />

      {selectedProperty ? (
        <article className="feature-card wide">
          <p className="eyebrow">Cached UX context</p>
          <h2>{selectedProperty.propertyName}</h2>
          <dl className="hospitality-metadata">
            <div><dt>Organization</dt><dd>{selectedProperty.organizationId}</dd></div>
            <div><dt>Property</dt><dd>{selectedProperty.propertyId}</dd></div>
          </dl>
          <p>This cache is display context only. It is not a property record and does not grant access.</p>
        </article>
      ) : null}

      <div className="feature-card wide hospitality-empty">
        <p className="eyebrow">Property catalog</p>
        <h2>No verified property catalog is connected</h2>
        <p>ATLAS will not invent properties or expose mutation controls. Connect a tenant-scoped backend source before property records can be listed or managed here.</p>
        <p>Analyze a manually entered scenario without importing unverified property context: <Link className="text-link" to="/real-estate">Open ATLAS Real Estate Intelligence</Link>.</p>
      </div>
    </section>
  );
}
