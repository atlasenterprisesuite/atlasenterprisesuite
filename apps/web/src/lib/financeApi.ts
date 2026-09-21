import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

type CapabilityRows<T> = {
  available: boolean;
  rows: T[];
  error: string | null;
};

type BalanceRow = { balance_due: number | string | null; status: string | null };
type JournalRow = { id: string; status: string | null };
type PeriodRow = {
  id: string;
  status: string | null;
  close_readiness: number | string | null;
  period_start: string | null;
  period_end: string | null;
};
type BudgetRow = { id: string; status: string | null };
type FxRow = { id: string; evidence_state: string | null };
type ConsolidationRow = { id: string; status: string | null };
type BankRow = { id: string };
type ReconciliationRow = { id: string; status: string | null };

export type FinanceControlCenterSnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  loadedAt: string;
  payables: CapabilityRows<BalanceRow>;
  receivables: CapabilityRows<BalanceRow>;
  journals: CapabilityRows<JournalRow>;
  periods: CapabilityRows<PeriodRow>;
  budgets: CapabilityRows<BudgetRow>;
  fxRates: CapabilityRows<FxRow>;
  consolidations: CapabilityRows<ConsolidationRow>;
  bankAccounts: CapabilityRows<BankRow>;
  reconciliations: CapabilityRows<ReconciliationRow>;
};

async function readCapability<T>(table: string, select: string, organizationId: string): Promise<CapabilityRows<T>> {
  try {
    const params = new URLSearchParams({
      select,
      org_id: `eq.${organizationId}`
    });
    const response = await authorizedAtlasFetch(`/rest/v1/${table}?${params.toString()}`);
    if (!response.ok) {
      return { available: false, rows: [], error: `HTTP ${response.status}` };
    }
    const body = await response.json();
    return {
      available: true,
      rows: Array.isArray(body) ? body as T[] : [],
      error: null
    };
  } catch (cause) {
    return {
      available: false,
      rows: [],
      error: cause instanceof Error ? cause.message : 'capability_unavailable'
    };
  }
}

export async function loadFinanceControlCenter(): Promise<FinanceControlCenterSnapshot> {
  const organization = await getActiveAtlasOrganization();

  const [
    payables,
    receivables,
    journals,
    periods,
    budgets,
    fxRates,
    consolidations,
    bankAccounts,
    reconciliations
  ] = await Promise.all([
    readCapability<BalanceRow>('accounting_bills', 'balance_due,status', organization.id),
    readCapability<BalanceRow>('invoices', 'balance_due,status', organization.id),
    readCapability<JournalRow>('journal_entries', 'id,status', organization.id),
    readCapability<PeriodRow>('accounting_periods', 'id,status,close_readiness,period_start,period_end', organization.id),
    readCapability<BudgetRow>('accounting_budgets', 'id,status', organization.id),
    readCapability<FxRow>('accounting_fx_rates', 'id,evidence_state', organization.id),
    readCapability<ConsolidationRow>('accounting_consolidation_groups', 'id,status', organization.id),
    readCapability<BankRow>('accounting_bank_accounts', 'id', organization.id),
    readCapability<ReconciliationRow>('accounting_reconciliation_sessions', 'id,status', organization.id)
  ]);

  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    loadedAt: new Date().toISOString(),
    payables,
    receivables,
    journals,
    periods,
    budgets,
    fxRates,
    consolidations,
    bankAccounts,
    reconciliations
  };
}
