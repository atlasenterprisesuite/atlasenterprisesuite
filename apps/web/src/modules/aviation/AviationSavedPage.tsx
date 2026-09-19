import { Link } from 'react-router-dom';
import { resolveAviationPersistenceState } from './aviation-persistence';

export function AviationSavedPage() {
  const persistenceState = resolveAviationPersistenceState({
    adapterConfigured: false,
    authorized: true
  });

  return (
    <section className="page-stack aviation-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Mobility · Aviation Intelligence</p>
        <h1>Saved Aircraft</h1>
        <p>A durable watchlist belongs to the authenticated ATLAS user and organization boundary. This slice does not simulate that store in the browser.</p>
      </header>

      <section className="aviation-capability-boundary" aria-labelledby="saved-aircraft-state">
        <span className="status-pill">{persistenceState.replace('_', ' ')}</span>
        <h2 id="saved-aircraft-state">Persistence not configured</h2>
        <p>No compatible organization-scoped Aviation watchlist adapter is configured yet. ATLAS will not display a fake save success or an in-memory list as durable data.</p>
        <Link className="text-link" to="/mobility/aviation/aircraft">Browse Aircraft Catalog</Link>
      </section>
    </section>
  );
}
