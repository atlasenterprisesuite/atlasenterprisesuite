import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { InsuranceHome } from './InsuranceHome';
import { InsuranceVerificationPage } from './InsuranceVerificationPage';

export function InsuranceRoutes() {
  return (
    <AtlasShell>
      <RequireAtlasIdentity>
        <Routes>
          <Route path="/insurance" element={<InsuranceHome />} />
          <Route path="/insurance/verify" element={<InsuranceVerificationPage />} />
        </Routes>
      </RequireAtlasIdentity>
    </AtlasShell>
  );
}
