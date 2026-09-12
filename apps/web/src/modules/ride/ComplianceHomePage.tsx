import { Link } from 'react-router-dom';
import { RideSubnav } from './RideSubnav';

export function ComplianceHomePage() {
  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">Driver / Partner</p>
        <h1>Compliance</h1>
        <p>Governed requirements and evidence lifecycle. Approval is shown only after an authorized review decision.</p>
      </header>
      <RideSubnav />
      <Link className="feature-card link-card" to="/ride/driver/compliance/documents">
        <p className="eyebrow">Evidence</p>
        <h2>Documents & Credentials</h2>
        <p>Open identity and credential requirements configured for this Ride participant.</p>
        <span className="action-link">Open documents & credentials</span>
      </Link>
    </section>
  );
}
