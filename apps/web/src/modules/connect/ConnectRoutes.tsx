import { Navigate, Route, Routes } from 'react-router-dom';
import { AtlasBroadcastChannelPage } from './AtlasBroadcastChannelPage';
import { AtlasMvnoControlPage } from './AtlasMvnoControlPage';
import { AtlasWirelessPage } from './AtlasWirelessPage';
import { ConnectHomePage } from './ConnectHomePage';
import { GoogleFiWirelessPage } from './GoogleFiWirelessPage';

export function ConnectRoutes() {
  return (
    <Routes>
      <Route path="/connect" element={<ConnectHomePage />} />
      <Route path="/connect/channel" element={<AtlasBroadcastChannelPage />} />
      <Route path="/connect/chat" element={<Navigate to="/connect" replace />} />
      <Route path="/connect/wireless" element={<AtlasWirelessPage />} />
      <Route path="/connect/wireless/mvno" element={<AtlasMvnoControlPage />} />
      <Route path="/connect/google-fi" element={<GoogleFiWirelessPage />} />
    </Routes>
  );
}
