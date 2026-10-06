import { Route, Routes } from 'react-router-dom';
import { CommercialLeadPage } from './CommercialLeadPage';
import { CommercialLegalPage } from './CommercialLegalPage';
import { CommercialPricingPage } from './CommercialPricingPage';
import { CommercialSecurityPage } from './CommercialSecurityPage';
import './commercial.css';

export function CommercialRoutes() {
  return (
    <Routes>
      <Route path="/pricing" element={<CommercialPricingPage />} />
      <Route path="/request-demo" element={<CommercialLeadPage intent="request-demo" />} />
      <Route path="/contact" element={<CommercialLeadPage intent="contact" />} />
      <Route path="/terms" element={<CommercialLegalPage document="terms" />} />
      <Route path="/privacy" element={<CommercialLegalPage document="privacy" />} />
      <Route path="/security" element={<CommercialSecurityPage />} />
    </Routes>
  );
}
