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


export type AccountingAccount = {
  id: string;
  account_number: string;
  name: string;
  account_type: string;
  active: boolean;
};

export type GeneralLedgerRow = {
  entry_date: string;
  entry_number: string;
  journal_entry_id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  memo: string | null;
  debit: number | string;
  credit: number | string;
  running_balance: number | string;
};

export type AccountingBankAccount = {
  id: string;
  display_name: string;
  account_type: string | null;
  currency: string;
  mask: string | null;
  connection_state: string;
  current_balance: number | string | null;
  balance_as_of: string | null;
};

export type AccountingReconciliationSession = {
  id: string;
  bank_account_id: string;
  period_start: string;
  period_end: string;
  statement_ending_balance: number | string | null;
  ledger_ending_balance: number | string | null;
  status: string;
  readiness_score: number | string;
  closed_at: string | null;
};

export type AccountingReconciliationItem = {
  id: string;
  session_id: string;
  transaction_id: string | null;
  match_type: string | null;
  status: string;
  variance: number | string;
  note: string | null;
  resolved_at: string | null;
};

export type AccountingClosePeriod = {
  id: string;
  entity_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  close_readiness: number | string;
  filing_readiness: number | string;
  closed_at: string | null;
};

export type AccountingCloseTask = {
  id: string;
  period_id: string;
  task_key: string;
  name: string;
  task_group: string;
  owner_label: string | null;
  status: string;
  blocker: string | null;
  due_at: string | null;
  weight: number | string;
  completed_at: string | null;
};

export type AccountingCloseReadiness = {
  ready: boolean;
  readiness_score: number | string;
  total_tasks: number;
  incomplete_tasks: number;
  unreconciled_sessions: number;
  unresolved_transactions: number;
  draft_journals: number;
  debit_credit_difference: number | string;
};

async function accountingRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await authorizedAtlasFetch(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    let message = `accounting_rpc_${name}_http_${response.status}`;
    try {
      const error = await response.json();
      message = String(error?.message || error?.error || message);
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function loadGeneralLedger(startDate: string, endDate: string, entityId: string | null = null) {
  const organization = await getActiveAtlasOrganization();
  const [ledger, accounts] = await Promise.all([
    accountingRpc<GeneralLedgerRow[]>('get_accounting_general_ledger', {
      organization_uuid: organization.id,
      entity_uuid: entityId,
      start_date: startDate,
      end_date: endDate
    }),
    readCapability<AccountingAccount>('chart_of_accounts', 'id,account_number,name,account_type,active', organization.id)
  ]);
  if (!accounts.available) throw new Error(accounts.error || 'chart_of_accounts_unavailable');
  return { organizationId: organization.id, ledger: Array.isArray(ledger) ? ledger : [], accounts: accounts.rows.filter(account => account.active) };
}

export async function createBalancedJournalEntry(input: {
  entryCode: string;
  entryDate: string;
  memo: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
}) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('create_balanced_journal_entry', {
    organization_uuid: organization.id,
    entry_code: input.entryCode.trim(),
    entry_on: input.entryDate,
    entry_memo: input.memo.trim(),
    debit_account_uuid: input.debitAccountId,
    credit_account_uuid: input.creditAccountId,
    entry_amount: input.amount
  });
}

export async function reversePostedJournalEntry(input: {
  journalId: string;
  reversalCode: string;
  reversalDate: string;
  reason: string;
}) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('reverse_posted_journal_entry', {
    organization_uuid: organization.id,
    journal_uuid: input.journalId,
    reversal_code: input.reversalCode.trim(),
    reversal_on: input.reversalDate,
    reversal_reason: input.reason.trim()
  });
}

export async function loadAccountingReconciliation() {
  const organization = await getActiveAtlasOrganization();
  const [banks, sessions, items] = await Promise.all([
    readCapability<AccountingBankAccount>('accounting_bank_accounts', 'id,display_name,account_type,currency,mask,connection_state,current_balance,balance_as_of', organization.id),
    readCapability<AccountingReconciliationSession>('accounting_reconciliation_sessions', 'id,bank_account_id,period_start,period_end,statement_ending_balance,ledger_ending_balance,status,readiness_score,closed_at', organization.id),
    readCapability<AccountingReconciliationItem>('accounting_reconciliation_items', 'id,session_id,transaction_id,match_type,status,variance,note,resolved_at', organization.id)
  ]);
  if (!banks.available) throw new Error(banks.error || 'accounting_bank_accounts_unavailable');
  if (!sessions.available) throw new Error(sessions.error || 'accounting_reconciliation_sessions_unavailable');
  if (!items.available) throw new Error(items.error || 'accounting_reconciliation_items_unavailable');
  return { organizationId: organization.id, banks: banks.rows, sessions: sessions.rows, items: items.rows };
}

export async function startAccountingReconciliation(input: {
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementBalance: number;
  ledgerBalance: number;
}) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('start_accounting_reconciliation', {
    organization_uuid: organization.id,
    bank_account_uuid: input.bankAccountId,
    period_start_date: input.periodStart,
    period_end_date: input.periodEnd,
    statement_balance: input.statementBalance,
    ledger_balance: input.ledgerBalance
  });
}

export async function closeAccountingReconciliation(sessionId: string) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('close_accounting_reconciliation', {
    organization_uuid: organization.id,
    session_uuid: sessionId
  });
}

export async function resolveAccountingReconciliationItem(input: {
  itemId: string;
  status: string;
  matchType: string;
  variance: number;
  note: string;
}) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('resolve_accounting_reconciliation_item', {
    organization_uuid: organization.id,
    item_uuid: input.itemId,
    item_status: input.status,
    item_match_type: input.matchType,
    item_variance: input.variance,
    item_note: input.note
  });
}

export async function loadAccountingClose() {
  const organization = await getActiveAtlasOrganization();
  const [periods, tasks] = await Promise.all([
    readCapability<AccountingClosePeriod>('accounting_periods', 'id,entity_id,period_start,period_end,status,close_readiness,filing_readiness,closed_at', organization.id),
    readCapability<AccountingCloseTask>('accounting_close_tasks', 'id,period_id,task_key,name,task_group,owner_label,status,blocker,due_at,weight,completed_at', organization.id)
  ]);
  if (!periods.available) throw new Error(periods.error || 'accounting_periods_unavailable');
  if (!tasks.available) throw new Error(tasks.error || 'accounting_close_tasks_unavailable');
  return { organizationId: organization.id, periods: periods.rows, tasks: tasks.rows };
}

export async function getAccountingCloseReadiness(periodId: string) {
  const organization = await getActiveAtlasOrganization();
  const result = await accountingRpc<AccountingCloseReadiness[]>('get_accounting_close_readiness', {
    organization_uuid: organization.id,
    period_uuid: periodId
  });
  return Array.isArray(result) ? result[0] || null : null;
}

export async function closeAccountingPeriod(periodId: string) {
  const organization = await getActiveAtlasOrganization();
  return accountingRpc<string>('close_accounting_period', {
    organization_uuid: organization.id,
    period_uuid: periodId
  });
}
