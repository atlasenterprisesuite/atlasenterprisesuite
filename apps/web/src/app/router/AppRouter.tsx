import { Route, Routes } from 'react-router-dom';
import { AtlasContextProvider } from '../providers/AtlasContext';
import { AtlasShell } from '../shell/AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';
import { FinanceHome } from '../../modules/finance/FinanceHome';
import { AccountingModulePlaceholder } from '../../modules/finance/accounting/AccountingModulePlaceholder';
import { PayablesPage } from '../../modules/finance/accounting/PayablesPage';
import { HealthRoutes } from '../../modules/health/HealthRoutes';

export function AppRouter() {
  return (
    <AtlasContextProvider>
      <AtlasShell>
        <Routes>
          <Route path="/" element={<EnterpriseHome />} />
          <Route path="/finance" element={<FinanceHome />} />
          <Route path="/finance/accounting" element={<AccountingModulePlaceholder />} />
          <Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} />
          <Route path="/health/*" element={<HealthRoutes />} />
          <Route path="*" element={<RouteErrorPage />} />
        </Routes>
      </AtlasShell>
    </AtlasContextProvider>
  );
}
