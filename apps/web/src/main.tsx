import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
import './styles.css';
import './health.css';
import './modules/finance/accounting/payables-ai.css';
import './modules/finance/accounting/accounting-workspace.css';
import './modules/hospitality/hospitality.css';

function RootRouter() {
  const location = useLocation();
  return location.pathname.startsWith('/hospitality') ? <HospitalityRoutes /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  </React.StrictMode>
);
