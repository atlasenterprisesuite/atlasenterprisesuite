import { Link } from 'react-router-dom';
import { resolveAviationPersistenceState } from './aviation-persistence';

export function AviationAlertsPage() {
  const persistenceState = resolveAviationPersistenceState({
    adapterConfigured: false,
    authorized: true
  });

  return (
    <section className="page-stack aviation-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility · Aviation Intelligence</p>
        <h1>Aviation Alerts</h1>
        <p>Certification, evidence and offering-change alerts require a durable organization/user-scoped rule store and auditable delivery pipeline.</p>
      </header>

      <section className="aviation-capability-boundary" aria-labelledby="aviation-alerts-state">
        <span className="status-pill">{persistenceState.replace('_', ' ')}</span>
        <h2 id="aviation-alerts-state">Persistence not configured</h2>
        <p>No compatible Aviation alert-rule adapter or delivery channel is configured. ATLAS therefore does not claim a rule was created, enabled or delivered.</p>
        <Link className="text-link" to="/mobility/aviation/certification">Open Certification Intelligence</Link>
      </section>
    </section>
  );
}
