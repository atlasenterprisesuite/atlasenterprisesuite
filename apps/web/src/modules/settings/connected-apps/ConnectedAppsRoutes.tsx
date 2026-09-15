import { Navigate, Route, Routes } from 'react-router-dom';
import { ConnectedAppsPage } from './ConnectedAppsPage';
import { ProviderDetailPage } from './ProviderDetailPage';
import './connectedApps.css';

const basePath = '/settings/security/connected-apps';

export function ConnectedAppsRoutes() {
  return (
    <Routes>
      <Route path={basePath} element={<ConnectedAppsPage />} />
      <Route path={`${basePath}/:providerKey`} element={<ProviderDetailPage />} />
      <Route path="*" element={<Navigate to={basePath} replace />} />
    </Routes>
  );
}
