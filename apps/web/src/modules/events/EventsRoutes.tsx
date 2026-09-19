import { Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../../components/AtlasShell';
import { RequireAtlasIdentity } from '../../identity/RequireAtlasIdentity';
import { EventsHomePage } from './EventsHomePage';

export function EventsRoutes() {
  return (
    <AtlasShell>
      <RequireAtlasIdentity>
        <Routes>
          <Route path="/events" element={<EventsHomePage />} />
          <Route path="/events/*" element={<Navigate to="/events" replace />} />
        </Routes>
      </RequireAtlasIdentity>
    </AtlasShell>
  );
}
