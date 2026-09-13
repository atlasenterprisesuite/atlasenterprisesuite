import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { AtlasShell } from './components/AtlasShell';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
import { AtlasVoicePage } from './modules/voice/AtlasVoicePage';
import './styles.css';
import './health.css';
import './execution/execution.css';
import './work/work.css';
import './neuroplasticity.css';
import './modules/finance/accounting/payables-ai.css';
import './modules/hospitality/hospitality.css';

function RootRouter() {
  const location = useLocation();
  if (location.pathname === '/voice') {
    return (
      <AtlasShell>
        <AtlasVoicePage />
      </AtlasShell>
    );
  }
  return location.pathname.startsWith('/hospitality') ? <HospitalityRoutes /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  </React.StrictMode>
);
