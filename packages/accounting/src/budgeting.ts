import type { AccountRecord, JournalRecord } from './types';

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
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number | null;
};

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
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      accountType: account.accountType,
      budget: money(budgetCents),
      actual: money(actualCents),
      variance: money(varianceCents),
      variancePct,
    };
  });
}
