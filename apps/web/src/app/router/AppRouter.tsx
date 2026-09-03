import { Route, Routes } from 'react-router-dom';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<EnterpriseHome />} />
      <Route path="*" element={<RouteErrorPage />} />
    </Routes>
  );
}
