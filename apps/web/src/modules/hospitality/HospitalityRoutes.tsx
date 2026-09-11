import { Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { RoomAccessPage } from './RoomAccessPage';

export function HospitalityRoutes() {
  return (
    <AtlasShell>
      <RequireAtlasIdentity>
        <Routes>
          <Route path="/hospitality" element={<Navigate to="/hospitality/access" replace />} />
          <Route path="/hospitality/access" element={<RoomAccessPage />} />
          <Route path="/hospitality/*" element={<Navigate to="/hospitality/access" replace />} />
        </Routes>
      </RequireAtlasIdentity>
    </AtlasShell>
  );
}
