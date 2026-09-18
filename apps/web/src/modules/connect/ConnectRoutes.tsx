import { Route, Routes } from 'react-router-dom';
import { AtlasBroadcastChannelPage } from './AtlasBroadcastChannelPage';
import { ConnectHomePage } from './ConnectHomePage';
import { GoogleFiWirelessPage } from './GoogleFiWirelessPage';

export function ConnectRoutes() {
  return (
    <Routes>
      <Route path="/connect" element={<ConnectHomePage />} />
      <Route path="/connect/channel" element={<AtlasBroadcastChannelPage />} />
      <Route path="/connect/google-fi" element={<GoogleFiWirelessPage />} />
    </Routes>
  );
}
