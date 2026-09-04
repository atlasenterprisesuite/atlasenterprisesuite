import { Route, Routes } from 'react-router-dom';
import { AtlasShell } from '../shell/AtlasShell';
import { RouteErrorPage } from '../errors/RouteErrorPage';
import { EnterpriseHome } from '../../modules/home/EnterpriseHome';
import { AccountingHome, FinanceHome } from '../../modules/finance/FinanceHome';
import { PayablesPage } from '../../modules/finance/accounting/PayablesPage';
import { HealthRoutes } from '../../modules/health/HealthRoutes';

export function AppRouter() { return <AtlasShell><Routes><Route path="/" element={<EnterpriseHome />} /><Route path="/finance" element={<FinanceHome />} /><Route path="/finance/accounting" element={<AccountingHome />} /><Route path="/finance/accounting/accounts-payable" element={<PayablesPage />} /><Route path="/health/*" element={<HealthRoutes />} /><Route path="*" element={<RouteErrorPage />} /></Routes></AtlasShell>; }
