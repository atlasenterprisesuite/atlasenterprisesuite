import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { AccountingPage } from '../../modules/accounting/AccountingPage';
import { ChartOfAccountsPage } from '../../modules/accounting/ChartOfAccountsPage';
import { GeneralLedgerPage } from '../../modules/accounting/GeneralLedgerPage';
import { JournalEntriesPage } from '../../modules/accounting/JournalEntriesPage';
import { PayablesPage } from '../../modules/accounting/PayablesPage';
import { ReceivablesPage } from '../../modules/accounting/ReceivablesPage';
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
        <Route path="/finance/accounting/general-ledger" element={<GeneralLedgerPage />} />
        <Route path="/finance/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="/finance/accounting/journal-entries" element={<JournalEntriesPage />} />
        <Route path="/finance/accounting/accounts-receivable" element={<ReceivablesPage />} />
        <Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} />
        <Route path="/health/*" element={<HealthRoutes />} />
      </Route>
      <Route path="*" element={<RouteErrorPage />} />
    </Routes>
  );
}
