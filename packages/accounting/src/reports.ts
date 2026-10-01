import type { AccountRecord, JournalRecord } from './types';

export type TrialBalanceRow = {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  totalDebits: number;
  totalCredits: number;
  balance: number;
};

export type TrialBalanceReport = {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
};

export type ProfitAndLossReport = {
  revenue: TrialBalanceRow[];
  expenses: TrialBalanceRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export type BalanceSheetReport = {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentEarnings: number;
  balanced: boolean;
};

const cents = (value: number) => Math.round(value * 100);
const money = (valueInCents: number) => valueInCents / 100;

function postedTotals(accounts: readonly AccountRecord[], journals: readonly JournalRecord[]) {
  const totals = new Map<string, { debitCents: number; creditCents: number }>();
  const knownAccounts = new Set(accounts.map((account) => account.id));

  for (const journal of journals) {
    if (journal.status !== 'posted') continue;
    for (const line of journal.lines) {
      if (!line.accountId || !knownAccounts.has(line.accountId)) continue;
      const current = totals.get(line.accountId) ?? { debitCents: 0, creditCents: 0 };
      current.debitCents += cents(Number(line.debit ?? 0));
      current.creditCents += cents(Number(line.credit ?? 0));
      totals.set(line.accountId, current);
    }
  }

  return totals;
}

export function trialBalance(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): TrialBalanceReport {
  const totals = postedTotals(accounts, journals);
  const rows = accounts.map((account) => {
    const accountTotals = totals.get(account.id) ?? { debitCents: 0, creditCents: 0 };
    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      accountName: account.name,
      accountType: account.accountType,
      totalDebits: money(accountTotals.debitCents),
      totalCredits: money(accountTotals.creditCents),
      balance: money(accountTotals.debitCents - accountTotals.creditCents),
    };
  });

  const totalDebitsCents = rows.reduce((sum, row) => sum + cents(row.totalDebits), 0);
  const totalCreditsCents = rows.reduce((sum, row) => sum + cents(row.totalCredits), 0);

  return {
    rows,
    totalDebits: money(totalDebitsCents),
    totalCredits: money(totalCreditsCents),
    balanced: totalDebitsCents === totalCreditsCents,
  };
}

export function profitAndLoss(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): ProfitAndLossReport {
  const report = trialBalance(accounts, journals);
  const revenue = report.rows.filter((row) => row.accountType === 'revenue');
  const expenses = report.rows.filter((row) => row.accountType === 'expense');

  const totalRevenueCents = revenue.reduce(
    (sum, row) => sum + cents(row.totalCredits) - cents(row.totalDebits),
    0,
  );
  const totalExpensesCents = expenses.reduce(
    (sum, row) => sum + cents(row.totalDebits) - cents(row.totalCredits),
    0,
  );

  return {
    revenue,
    expenses,
    totalRevenue: money(totalRevenueCents),
    totalExpenses: money(totalExpensesCents),
    netIncome: money(totalRevenueCents - totalExpensesCents),
  };
}

export function balanceSheet(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): BalanceSheetReport {
  const report = trialBalance(accounts, journals);
  const assets = report.rows.filter((row) => row.accountType === 'asset');
  const liabilities = report.rows.filter((row) => row.accountType === 'liability');
  const equity = report.rows.filter((row) => row.accountType === 'equity');

  const totalAssetsCents = assets.reduce(
    (sum, row) => sum + cents(row.totalDebits) - cents(row.totalCredits),
    0,
  );
  const totalLiabilitiesCents = liabilities.reduce(
    (sum, row) => sum + cents(row.totalCredits) - cents(row.totalDebits),
    0,
  );
  const totalEquityCents = equity.reduce(
    (sum, row) => sum + cents(row.totalCredits) - cents(row.totalDebits),
    0,
  );
  const currentEarningsCents = cents(profitAndLoss(accounts, journals).netIncome);

  return {
    assets,
    liabilities,
    equity,
    totalAssets: money(totalAssetsCents),
    totalLiabilities: money(totalLiabilitiesCents),
    totalEquity: money(totalEquityCents),
    currentEarnings: money(currentEarningsCents),
    balanced: totalAssetsCents === totalLiabilitiesCents + totalEquityCents + currentEarningsCents,
  };
}
