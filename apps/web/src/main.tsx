import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { App } from './App';
import { HospitalityRoutes } from './modules/hospitality/HospitalityRoutes';
import { RideRoutes } from './modules/ride/RideRoutes';
import './styles.css';
import './health.css';
import './modules/finance/accounting/payables-ai.css';
import './modules/hospitality/hospitality.css';
import './modules/ride/ride.css';

function RootRouter() {
  const location = useLocation();
  if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;
  if (location.pathname.startsWith('/ride')) return <RideRoutes />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  </React.StrictMode>
);
