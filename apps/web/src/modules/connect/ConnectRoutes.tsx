import { Route, Routes } from 'react-router-dom';
import { ConnectHomePage } from './ConnectHomePage';
import { GoogleFiWirelessPage } from './GoogleFiWirelessPage';

export function ConnectRoutes() {
  return (
    <Routes>
      <Route path="/connect" element={<ConnectHomePage />} />
      <Route path="/connect/google-fi" element={<GoogleFiWirelessPage />} />
    </Routes>
  );
}
