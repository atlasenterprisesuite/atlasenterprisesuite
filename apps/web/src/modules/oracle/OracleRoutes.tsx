import { Link, Navigate, useLocation } from 'react-router-dom';
import { RequireOracleEntitlement } from './RequireOracleEntitlement';
import { OracleDeckPage } from './OracleDeckPage';
import { OracleHomePage } from './OracleHomePage';
import { OracleReadingPage } from './OracleReadingPage';
import './oracle.css';

function OracleRouteView({ pathname }: { pathname: string }) {
  if (pathname === '/assistant/oracle' || pathname === '/assistant/oracle/') {
    return <OracleHomePage />;
  }

  if (pathname === '/assistant/oracle/deck' || pathname === '/assistant/oracle/deck/') {
    return <OracleDeckPage />;
  }

  const readingMatch = pathname.match(/^\/assistant\/oracle\/readings\/([^/]+)\/?$/);
  if (readingMatch) {
    return <OracleReadingPage />;
  }

  return <Navigate to="/assistant/oracle" replace />;
}

export function OracleRoutes() {
  const location = useLocation();

  return (
    <RequireOracleEntitlement>
      <section className="oracle-workspace" aria-label="ATLAS Mystic Oracle private workspace">
        <header className="oracle-workspace-bar">
          <div>
            <span className="oracle-kicker">ATLAS Assistant · Private</span>
            <strong>Mystic Oracle</strong>
          </div>
          <nav aria-label="Mystic Oracle navigation">
            <Link className={location.pathname === '/assistant/oracle' || location.pathname === '/assistant/oracle/' ? 'active' : ''} to="/assistant/oracle">Readings</Link>
            <Link className={location.pathname.includes('/deck') ? 'active' : ''} to="/assistant/oracle/deck">Deck Library</Link>
          </nav>
        </header>

        <OracleRouteView pathname={location.pathname} />
      </section>
    </RequireOracleEntitlement>
  );
}
