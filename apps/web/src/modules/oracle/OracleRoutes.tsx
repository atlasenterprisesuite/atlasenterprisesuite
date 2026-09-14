import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireOracleEntitlement } from './RequireOracleEntitlement';
import { OracleDeckPage } from './OracleDeckPage';
import { OracleHomePage } from './OracleHomePage';
import { OracleReadingPage } from './OracleReadingPage';
import './oracle.css';

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
            <Link className={location.pathname === '/assistant/oracle' ? 'active' : ''} to="/assistant/oracle">Readings</Link>
            <Link className={location.pathname.includes('/deck') ? 'active' : ''} to="/assistant/oracle/deck">Deck Library</Link>
          </nav>
        </header>

        <Routes>
          <Route path="/assistant/oracle" element={<OracleHomePage />} />
          <Route path="/assistant/oracle/deck" element={<OracleDeckPage />} />
          <Route path="/assistant/oracle/readings/:readingId" element={<OracleReadingPage />} />
          <Route path="*" element={<Navigate to="/assistant/oracle" replace />} />
        </Routes>
      </section>
    </RequireOracleEntitlement>
  );
}
