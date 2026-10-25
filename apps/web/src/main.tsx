import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { CopyPaste777Page } from './modules/tools/CopyPaste777Page';
import { RequireAtlasIdentity } from './identity/RequireAtlasIdentity';
import { AtlasRuntimeIntegrityProvider } from './runtime/AtlasRuntimeIntegrityProvider';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
import { RideRoutes } from './modules/ride/RideRoutes';
import './atlas-design-tokens.css';
import './styles.css';
import './health.css';
import './accessibility.css';
import './execution/execution.css';
import './work/work.css';
import './neuroplasticity.css';
import './modules/finance/accounting/payables-ai.css';
import './modules/galaxy/galaxy.css';
import './modules/cloud/cloud.css';
import './modules/galaxy/portals.css';
import './modules/hospitality/hospitality.css';
import './modules/ride/ride.css';
import './modules/release/stewardship-release.css';
import './runtime/runtime-integrity.css';

function RootRouter() {
  const location = useLocation();
  if (location.pathname === '/tools/copy-paste-777') return <RequireAtlasIdentity><CopyPaste777Page /></RequireAtlasIdentity>;
  if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;
  if (location.pathname.startsWith('/ride')) return <RideRoutes />;
  return <><App /><a href="/tools/copy-paste-777" aria-label="Abrir ATLAS Copiar y Pegar 777" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, padding: '10px 14px', background: '#153e75', color: 'white', borderRadius: 12, textDecoration: 'none' }}>Copiar y Pegar 777</a></>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AtlasRuntimeIntegrityProvider>
      <BrowserRouter>
        <RootRouter />
      </BrowserRouter>
    </AtlasRuntimeIntegrityProvider>
  </React.StrictMode>
);
