import { useLocation } from 'react-router-dom';
import { RouteErrorPage } from '../../app/errors/RouteErrorPage';

export function HealthRoutes() {
  const { pathname } = useLocation();
  const isHealthRoot = pathname === '/health' || pathname === '/health/';
  const isHistoricalResearchRoute =
    pathname === '/health/research' || pathname.startsWith('/health/research/frontiers');

  if (!isHealthRoot && !isHistoricalResearchRoute) {
    return <RouteErrorPage />;
  }

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Health</p>
      <h1>ATLAS Health</h1>

      {isHistoricalResearchRoute ? (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Historical Health source unavailable in this baseline</strong>
          <span>
            The known route is preserved so navigation does not silently break. Clinical and research data are not being simulated.
          </span>
        </section>
      ) : (
        <section className="atlas-status-panel" role="status">
          <strong>Safe handoff active</strong>
          <span>
            Health remains inside the shared ATLAS shell while its historical implementation is reconnected through verified sources and permissions.
          </span>
        </section>
      )}
    </main>
  );
}
