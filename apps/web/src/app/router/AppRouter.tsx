import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { AccountingPage } from '../../modules/accounting/AccountingPage';
import { BankCashPage } from '../../modules/accounting/BankCashPage';
import { ChartOfAccountsPage } from '../../modules/accounting/ChartOfAccountsPage';
import { GeneralLedgerPage } from '../../modules/accounting/GeneralLedgerPage';
import { JournalEntriesPage } from '../../modules/accounting/JournalEntriesPage';
import { PayablesPage } from '../../modules/accounting/PayablesPage';
import { ReceivablesPage } from '../../modules/accounting/ReceivablesPage';
import { ReconciliationPage } from '../../modules/accounting/ReconciliationPage';
import { FinanceHome } from '../../modules/finance/FinanceHome';
import { HealthRoutes } from '../../modules/health/HealthRoutes';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';
import { PeopleHome } from '../../modules/people/PeopleHome';
import { PeoplePayrollRoute } from '../../modules/people/PeoplePayrollRoute';
import { PeopleRecruitingRoute } from '../../modules/people/PeopleRecruitingRoute';
import { PeopleSelfServiceRoute } from '../../modules/people/PeopleSelfServiceRoute';
import { PeopleTimeRoute } from '../../modules/people/PeopleTimeRoute';
import { TelecomMifiRoute } from '../../modules/telecom/TelecomMifiRoute';
import { SpatialEntry } from '../../spatial/SpatialEntry';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AtlasShell />}>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/spatial" element={<SpatialEntry />} />
        <Route path="/finance" element={<FinanceHome />} />
        <Route path="/finance/accounting" element={<AccountingPage />} />
        <Route path="/finance/accounting/general-ledger" element={<GeneralLedgerPage />} />
        <Route path="/finance/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
        <Route path="/finance/accounting/journal-entries" element={<JournalEntriesPage />} />
        <Route path="/finance/accounting/accounts-receivable" element={<ReceivablesPage />} />
        <Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} />
        <Route path="/finance/accounting/bank-cash" element={<BankCashPage />} />
        <Route path="/finance/accounting/reconciliation" element={<ReconciliationPage />} />
        <Route path="/people" element={<PeopleHome />} />
        <Route path="/people/time" element={<PeopleTimeRoute />} />
        <Route path="/people/payroll" element={<PeoplePayrollRoute />} />
        <Route path="/people/recruiting" element={<PeopleRecruitingRoute />} />
        <Route path="/people/self-service" element={<PeopleSelfServiceRoute />} />
        <Route path="/health/*" element={<HealthRoutes />} />
        <Route path="/telecom/devices/mifi" element={<TelecomMifiRoute />} />
      </Route>
      <Route path="*" element={<RouteErrorPage />} />
    </Routes>
  );
}
