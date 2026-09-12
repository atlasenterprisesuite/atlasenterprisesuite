import type { AccountRecord, JournalRecord } from './types';

export type AccountingBudgetRow = {
  id: string;
  org_id: string | null;
  entity_id: string | null;
  name: string;
  fiscal_year: number;
  version: number;
  scenario: string;
  status: string;
  base_currency: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AccountingBudgetRecord = {
  id: string;
  organizationId: string | null;
  entityId: string | null;
  name: string;
  fiscalYear: number;
  version: number;
  scenario: string;
  status: string;
  baseCurrency: string;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BudgetLineRow = {
  id: string;
  org_id: string | null;
  budget_id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  dimension: unknown;
  note: string | null;
};

export type BudgetLineRecord = {
  id: string;
  organizationId: string | null;
  budgetId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dimension: unknown;
  note: string | null;
};

export type BudgetVarianceRow = {
  budgetLineId: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  periodStart: string;
  periodEnd: string;
  dimension: unknown;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number | null;
};

export function mapAccountingBudget(row: AccountingBudgetRow): AccountingBudgetRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    entityId: row.entity_id,
    name: row.name,
    fiscalYear: Number(row.fiscal_year),
    version: Number(row.version),
    scenario: row.scenario,
    status: row.status,
    baseCurrency: row.base_currency,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBudgetLine(row: BudgetLineRow): BudgetLineRecord {
  return {
    id: row.id,
    organizationId: row.org_id,
    budgetId: row.budget_id,
    accountId: row.account_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: Number(row.amount),
    dimension: row.dimension,
    note: row.note,
  };
}

function cents(value: number) {
  return Math.round(Number(value) * 100);
}

function money(valueInCents: number) {
  return valueInCents / 100;
}

function normalizedActual(accountType: string, debitCents: number, creditCents: number) {
  return ['revenue', 'liability', 'equity'].includes(accountType)
    ? creditCents - debitCents
    : debitCents - creditCents;
}

export function budgetVsActual(
  accounts: readonly AccountRecord[],
  budgetLines: readonly BudgetLineRecord[],
  journals: readonly JournalRecord[],
): BudgetVarianceRow[] {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  return budgetLines.map((budgetLine) => {
    const account = accountMap.get(budgetLine.accountId);
    if (!account) throw new Error(`Budget line references unknown account: ${budgetLine.accountId}`);

    let debitCents = 0;
    let creditCents = 0;
    for (const journal of journals) {
      if (journal.status !== 'posted' || !journal.entryDate) continue;
      if (journal.entryDate < budgetLine.periodStart || journal.entryDate > budgetLine.periodEnd) continue;
      for (const line of journal.lines) {
        if (line.accountId !== budgetLine.accountId) continue;
        debitCents += cents(Number(line.debit ?? 0));
        creditCents += cents(Number(line.credit ?? 0));
      }
    }

    const budgetCents = cents(budgetLine.amount);
    const actualCents = normalizedActual(account.accountType, debitCents, creditCents);
    const varianceCents = actualCents - budgetCents;
    const variancePct = budgetCents === 0
      ? null
      : Math.round((varianceCents / Math.abs(budgetCents)) * 10000) / 100;

    return {
      budgetLineId: budgetLine.id,
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      accountType: account.accountType,
      periodStart: budgetLine.periodStart,
      periodEnd: budgetLine.periodEnd,
      dimension: budgetLine.dimension,
      budget: money(budgetCents),
      actual: money(actualCents),
      variance: money(varianceCents),
      variancePct,
    };
  });
}