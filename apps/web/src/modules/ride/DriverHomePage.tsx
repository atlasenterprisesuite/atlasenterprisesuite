import { Link } from 'react-router-dom';
import { RideSubnav } from './RideSubnav';

export function DriverHomePage() {
  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Ride</p>
        <h1>Driver / Partner</h1>
        <p>Identity, onboarding and compliance requirements scoped to the authenticated participant.</p>
      </header>
      <RideSubnav />
      <Link className="feature-card link-card" to="/ride/driver/compliance">
        <p className="eyebrow">Readiness</p>
        <h2>Compliance</h2>
        <p>Review required evidence, submission state and authorized review outcomes.</p>
        <span className="action-link">Open compliance</span>
      </Link>
    </section>
  );
}
