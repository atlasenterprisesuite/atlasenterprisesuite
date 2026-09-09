import { Navigate, Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { ModuleGatewayPage } from '../modules/ModuleGatewayPage';
import { IdentityPage } from '../../identity/IdentityPage';
import { AccountingPage } from '../../modules/accounting/AccountingPage';
import { BankCashPage } from '../../modules/accounting/BankCashPage';
import { ChartOfAccountsPage } from '../../modules/accounting/ChartOfAccountsPage';
import { GeneralLedgerPage } from '../../modules/accounting/GeneralLedgerPage';
import { JournalEntriesPage } from '../../modules/accounting/JournalEntriesPage';
import { PayablesPage } from '../../modules/accounting/PayablesPage';
import { ReceivablesPage } from '../../modules/accounting/ReceivablesPage';
import { ReconciliationPage } from '../../modules/accounting/ReconciliationPage';
import { AutomationsRoute } from '../../modules/automations/AutomationsRoute';
import { FinanceHome } from '../../modules/finance/FinanceHome';
import { HealthRoutes } from '../../modules/health/HealthRoutes';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';
import { PeopleCompensationRoute } from '../../modules/people/PeopleCompensationRoute';
import { PeopleHome } from '../../modules/people/PeopleHome';
import { PeoplePayrollRoute } from '../../modules/people/PeoplePayrollRoute';
import { PeopleRecruitingRoute } from '../../modules/people/PeopleRecruitingRoute';
import { PeopleSelfServiceRoute } from '../../modules/people/PeopleSelfServiceRoute';
import { PeopleTimeRoute } from '../../modules/people/PeopleTimeRoute';
import { ReleaseControllerRoute } from '../../modules/release/ReleaseControllerRoute';
import { RevenueOpsRoute } from '../../modules/revenue/RevenueOpsRoute';
import { SiteReviewRoute } from '../../modules/site-review/SiteReviewRoute';
import { TelecomMifiRoute } from '../../modules/telecom/TelecomMifiRoute';
import { ApplePersonalVoicePage } from '../../modules/voice/ApplePersonalVoicePage';
import { PersonalVoicePage } from '../../modules/voice/PersonalVoicePage';
import { VoiceHomePage } from '../../modules/voice/VoiceHomePage';
import { VoiceRoute } from '../../modules/voice/VoiceRoute';
import { SpatialRoute } from '../../spatial/SpatialRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/identity" element={<IdentityPage />} />

      <Route element={<AtlasShell />}>
        <Route path="/" element={<EnterpriseHome />} />
        <Route path="/app" element={<EnterpriseHome />} />

        <Route path="/app/hr" element={<Navigate to="/people" replace />} />
        <Route path="/app/payroll" element={<Navigate to="/people/payroll" replace />} />
        <Route path="/app/finance" element={<Navigate to="/finance" replace />} />
        <Route path="/app/erp" element={<Navigate to="/operations" replace />} />
        <Route path="/app/pay-wallet" element={<ModuleGatewayPage moduleId="pay-wallet" />} />
        <Route path="/app/health/*" element={<Navigate to="/health" replace />} />
        <Route path="/app/education" element={<ModuleGatewayPage moduleId="education" />} />
        <Route path="/app/analytics" element={<ModuleGatewayPage moduleId="analytics" />} />
        <Route path="/app/connect" element={<ModuleGatewayPage moduleId="connect" />} />
        <Route path="/app/documents" element={<ModuleGatewayPage moduleId="documents" />} />
        <Route path="/app/knowledge" element={<ModuleGatewayPage moduleId="knowledge" />} />
        <Route path="/app/security" element={<ModuleGatewayPage moduleId="security" />} />
        <Route path="/app/identity" element={<ModuleGatewayPage moduleId="identity" />} />
        <Route path="/app/projects" element={<ModuleGatewayPage moduleId="projects" />} />
        <Route path="/app/studio" element={<ModuleGatewayPage moduleId="studio" />} />
        <Route path="/app/workbench" element={<ModuleGatewayPage moduleId="workbench" />} />
        <Route path="/app/ride" element={<ModuleGatewayPage moduleId="ride" />} />
        <Route path="/app/global" element={<ModuleGatewayPage moduleId="global" />} />

        <Route path="/spatial" element={<SpatialRoute />} />
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
        <Route path="/people/compensation" element={<PeopleCompensationRoute />} />
        <Route path="/people/recruiting" element={<PeopleRecruitingRoute />} />
        <Route path="/people/self-service" element={<PeopleSelfServiceRoute />} />
        <Route path="/operations" element={<RevenueOpsRoute />} />
        <Route path="/automations" element={<AutomationsRoute />} />
        <Route path="/site-review" element={<SiteReviewRoute />} />
        <Route path="/release" element={<ReleaseControllerRoute />} />
        <Route path="/health/*" element={<HealthRoutes />} />
        <Route path="/voice" element={<VoiceRoute><VoiceHomePage /></VoiceRoute>} />
        <Route path="/voice/personal-voice" element={<VoiceRoute><PersonalVoicePage /></VoiceRoute>} />
        <Route path="/voice/personal-voice/apple" element={<VoiceRoute><ApplePersonalVoicePage /></VoiceRoute>} />
        <Route path="/telecom/devices/mifi" element={<TelecomMifiRoute />} />
      </Route>
      <Route path="*" element={<RouteErrorPage />} />
    </Routes>
  );
}
