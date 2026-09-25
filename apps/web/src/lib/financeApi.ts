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
export type BudgetRow = {
  id: string;
  entity_id: string | null;
  name: string;
  fiscal_year: number;
  version: number;
  scenario: string;
  status: string | null;
  base_currency: string;
};
export type BudgetLineRow = {
  id: string;
  budget_id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  amount: number | string;
  dimension: Record<string, unknown> | null;
};
export type FpaWorkspaceSnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  loadedAt: string;
  budgets: BudgetRow[];
  lines: BudgetLineRow[];
};
type FxRow = { id: string; evidence_state: string | null };
type ConsolidationRow = { id: string; status: string | null };
export type IntercompanyCandidateRow = {
  line_id: string;
  journal_id: string;
  entry_number: string;
  entry_date: string;
  entity_id: string;
  entity_code: string;
  entity_name: string;
  account_id: string;
  account_number: string;
  account_name: string;
  debit: number | string;
  credit: number | string;
  functional_currency: string;
  reporting_currency: string;
  reporting_amount: number | string;
  latest_match_id: string | null;
  latest_match_reference: string | null;
  latest_match_status: string | null;
};

export type IntercompanyWorkspaceSnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  groupId: string;
  loadedAt: string;
  candidates: IntercompanyCandidateRow[];
};
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
    readCapability<BudgetRow>('accounting_budgets', 'id,entity_id,name,fiscal_year,version,scenario,status,base_currency', organization.id),
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


export async function loadIntercompanyWorkspace(
  groupId: string,
  options: { startDate?: string; endDate?: string } = {}
): Promise<IntercompanyWorkspaceSnapshot> {
  const organization = await getActiveAtlasOrganization();
  const body = {
    organization_uuid: organization.id,
    group_uuid: groupId,
    start_date_value: options.startDate || null,
    end_date_value: options.endDate || null
  };

  const response = await authorizedAtlasFetch('/rest/v1/rpc/get_accounting_intercompany_candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`intercompany_candidates_http_${response.status}`);
  }

  const rows = await response.json();
  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    groupId,
    loadedAt: new Date().toISOString(),
    candidates: Array.isArray(rows) ? rows as IntercompanyCandidateRow[] : []
  };
}


export async function loadFpaWorkspace(): Promise<FpaWorkspaceSnapshot> {
  const organization = await getActiveAtlasOrganization();
  const [budgets, lines] = await Promise.all([
    readCapability<BudgetRow>(
      'accounting_budgets',
      'id,entity_id,name,fiscal_year,version,scenario,status,base_currency',
      organization.id
    ),
    readCapability<BudgetLineRow>(
      'accounting_budget_lines',
      'id,budget_id,account_id,period_start,period_end,amount,dimension',
      organization.id
    )
  ]);

  if (!budgets.available) throw new Error(budgets.error || 'budgets_unavailable');
  if (!lines.available) throw new Error(lines.error || 'budget_lines_unavailable');

  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    loadedAt: new Date().toISOString(),
    budgets: budgets.rows,
    lines: lines.rows
  };
}
