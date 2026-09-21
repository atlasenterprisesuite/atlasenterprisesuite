import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { ComplianceHomePage } from './ComplianceHomePage';
import { DocumentsPage } from './DocumentsPage';
import { DriverHomePage } from './DriverHomePage';
import { ProfilePhotoCompliancePage } from './ProfilePhotoCompliancePage';
import { RideHomePage } from './RideHomePage';
import { RideReadinessPage } from './RideReadinessPage';

export function RideRoutes() {
  return (
    <AtlasShell>
      <RequireAtlasIdentity>
        <Routes>
          <Route path="/ride" element={<RideHomePage />} />
          <Route path="/ride/driver" element={<DriverHomePage />} />
          <Route path="/ride/readiness" element={<RideReadinessPage />} />
          <Route path="/ride/driver/compliance" element={<ComplianceHomePage />} />
          <Route path="/ride/driver/compliance/documents" element={<DocumentsPage />} />
          <Route path="/ride/driver/compliance/documents/profile-photo" element={<ProfilePhotoCompliancePage />} />
        </Routes>
      </RequireAtlasIdentity>
    </AtlasShell>
  );
}
