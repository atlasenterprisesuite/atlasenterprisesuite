import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const resolver = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');
const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const experiences = readFileSync('apps/web/src/modules/experience/AtlasModuleExperiences.tsx', 'utf8');
const api = readFileSync('apps/web/src/lib/financeApi.ts', 'utf8');
const panel = readFileSync('apps/web/src/modules/finance/FinanceControlCenterPanel.tsx', 'utf8');

describe('ATLAS Finance web completion', () => {
  it('protects Finance and Accounting with the canonical identity boundary', () => {
    expect(resolver).toContain("pathname === '/finance') return <RequireAtlasIdentity><FinanceExperiencePage /></RequireAtlasIdentity>");
    expect(resolver).toContain("pathname === '/finance/accounting') return <RequireAtlasIdentity><AccountingExperiencePage /></RequireAtlasIdentity>");
    expect(app).toContain('path="/finance/accounting/accounts-payable" element={<RequireAtlasIdentity><PayablesPage /></RequireAtlasIdentity>}');
    expect(app).toContain('path="/finance/accounting/reports/automotive-sales" element={<RequireAtlasIdentity><AutomotiveSalesReportingPage /></RequireAtlasIdentity>}');
  });

  it('surfaces the live Finance control center from the canonical experience page', () => {
    expect(experiences).toContain("import { FinanceControlCenterPanel } from '../finance/FinanceControlCenterPanel'");
    expect(experiences).toContain('<FinanceControlCenterPanel />');
    expect(panel).toContain('Finance Control Center');
    expect(panel).toContain('Supabase RLS · live organization');
    expect(panel).toContain('it does not auto-post journals');
  });

  it('queries existing organization-scoped Finance contracts without fabricating totals', () => {
    for (const table of [
      'accounting_bills',
      'invoices',
      'journal_entries',
      'accounting_periods',
      'accounting_budgets',
      'accounting_fx_rates',
      'accounting_consolidation_groups',
      'accounting_bank_accounts',
      'accounting_reconciliation_sessions'
    ]) {
      expect(api).toContain(`readCapability<`);
      expect(api).toContain(`'${table}'`);
    }
    expect(api).toContain("source: 'supabase_rls_live'");
    expect(panel).toContain("return available ? value : 'Unavailable'");
  });

  it('keeps implemented finance workflows directly reachable', () => {
    expect(panel).toContain('to="/finance/accounting/accounts-payable"');
    expect(panel).toContain('to="/finance/accounting/accounts-receivable"');
    expect(panel).toContain('to="/inventory/procure-to-pay"');
    expect(panel).toContain('to="/finance/accounting/reports/automotive-sales"');
    expect(registry).toContain("{ to: '/finance/accounting/accounts-receivable', label: 'Receivables' }");
  });
});
