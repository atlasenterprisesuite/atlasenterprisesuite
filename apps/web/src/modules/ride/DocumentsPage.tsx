import { Link } from 'react-router-dom';
import { RideSubnav } from './RideSubnav';

export function DocumentsPage() {
  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Ride Compliance</p>
        <h1>Documents & Credentials</h1>
        <p>Only configured requirements are actionable. ATLAS does not invent document status or external verification.</p>
      </header>
      <RideSubnav />
      <div className="module-grid">
        <Link className="module-card enabled" to="/ride/driver/compliance/documents/profile-photo">
          <span>Identity evidence</span>
          <strong>Profile Photo</strong>
          <p>View the current reverification requirement, submit private evidence, and follow its review lifecycle.</p>
        </Link>
      </div>
      <div className="empty-state">
        <strong>Other document types are not configured in this slice</strong>
        <span>License, insurance, registration, inspection and background-check references will appear only when a real governed requirement exists.</span>
      </div>
    </section>
  );
}
