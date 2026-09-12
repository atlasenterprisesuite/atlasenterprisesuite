import { Link } from 'react-router-dom';
import { RideSubnav } from './RideSubnav';

export function RideHomePage() {
  return (
    <section className="page-stack ride-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility</p>
        <h1>ATLAS Ride</h1>
        <p>Governed driver and partner readiness, beginning with identity and compliance evidence.</p>
      </header>
      <RideSubnav />
      <div className="module-grid">
        <Link className="module-card enabled" to="/ride/driver">
          <span>People & readiness</span>
          <strong>Driver / Partner</strong>
          <p>Open onboarding and compliance requirements for the authenticated Ride participant.</p>
        </Link>
      </div>
      <div className="notice">Trip dispatch, pricing, fleet connectivity and external rideshare provider connections are not represented as active in this slice.</div>
    </section>
  );
}
