import { Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { AuditPage } from './AuditPage';
import { CredentialsPage } from './CredentialsPage';
import { ProvidersPage } from './ProvidersPage';
import { RoomAccessPage } from './RoomAccessPage';
import { RoomsPage } from './RoomsPage';

export function HospitalityRoutes() {
  return (
    <AtlasShell>
      <RequireAtlasIdentity>
        <Routes>
          <Route path="/hospitality" element={<Navigate to="/hospitality/access" replace />} />
          <Route path="/hospitality/access" element={<RoomAccessPage />} />
          <Route path="/hospitality/access/providers" element={<ProvidersPage />} />
          <Route path="/hospitality/access/rooms" element={<RoomsPage />} />
          <Route path="/hospitality/access/credentials" element={<CredentialsPage />} />
          <Route path="/hospitality/access/audit" element={<AuditPage />} />
          <Route path="/hospitality/*" element={<Navigate to="/hospitality/access" replace />} />
        </Routes>
      </RequireAtlasIdentity>
    </AtlasShell>
  );
}
