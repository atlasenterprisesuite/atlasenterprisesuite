import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { AtlasRuntimeIntegrityProvider } from './runtime/AtlasRuntimeIntegrityProvider';
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

const HospitalityRoutes = lazy(() => import('./modules/hospitality/HospitalityRoutes').then(module => ({ default: module.HospitalityRoutes })));
const RideRoutes = lazy(() => import('./modules/ride/RideRoutes').then(module => ({ default: module.RideRoutes })));

function RootRouter() {
  const location = useLocation();
  if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;
  if (location.pathname.startsWith('/ride')) return <RideRoutes />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AtlasRuntimeIntegrityProvider>
      <BrowserRouter>
        <Suspense fallback={<main role="status" aria-live="polite">Cargando módulo ATLAS…</main>}>
          <RootRouter />
        </Suspense>
      </BrowserRouter>
    </AtlasRuntimeIntegrityProvider>
  </React.StrictMode>
);
