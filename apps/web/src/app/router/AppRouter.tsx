import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { AccountingPage } from '../../modules/accounting/AccountingPage';
import { FinanceHome } from '../../modules/finance/FinanceHome';
import { HealthRoutes } from '../../modules/health/HealthRoutes';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AtlasShell />}>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/finance" element={<FinanceHome />} />
        <Route path="/finance/accounting" element={<AccountingPage />} />
        <Route path="/health/*" element={<HealthRoutes />} />
      </Route>
      <Route path="*" element={<RouteErrorPage />} />
    </Routes>
  );
}
