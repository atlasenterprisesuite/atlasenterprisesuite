import type { AccountRecord, JournalRecord } from './types';

export interface AccountBalanceRow {
  accountId: string;
  accountNumber: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceReport {
  rows: AccountBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  difference: number;
}

export interface ProfitAndLossReport {
  revenue: AccountBalanceRow[];
  expenses: AccountBalanceRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetReport {
  assets: AccountBalanceRow[];
  liabilities: AccountBalanceRow[];
  equity: AccountBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentEarnings: number;
  liabilitiesAndEquity: number;
  difference: number;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function activityByAccount(journals: readonly JournalRecord[]) {
  const activity = new Map<string, { debit: number; credit: number }>();
  for (const journal of journals) {
    if (journal.status !== 'posted') continue;
    for (const line of journal.lines) {
      if (!line.accountId) continue;
      const current = activity.get(line.accountId) ?? { debit: 0, credit: 0 };
      current.debit = money(current.debit + (line.debit ?? 0));
      current.credit = money(current.credit + (line.credit ?? 0));
      activity.set(line.accountId, current);
    }
  }
  return activity;
}

function normalBalance(accountType: string, debit: number, credit: number): number {
  return accountType === 'liability' || accountType === 'equity' || accountType === 'revenue'
    ? money(credit - debit)
    : money(debit - credit);
}

function reportRows(accounts: readonly AccountRecord[], journals: readonly JournalRecord[]): AccountBalanceRow[] {
  const activity = activityByAccount(journals);
  return accounts
    .map((account) => {
      const totals = activity.get(account.id) ?? { debit: 0, credit: 0 };
      return {
        accountId: account.id,
        accountNumber: account.accountNumber,
        name: account.name,
        accountType: account.accountType,
        debit: totals.debit,
        credit: totals.credit,
        balance: normalBalance(account.accountType, totals.debit, totals.credit),
      };
    })
    .filter((row) => row.debit !== 0 || row.credit !== 0)
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

export function trialBalance(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): TrialBalanceReport {
  const rows = reportRows(accounts, journals).map((row) => {
    const net = money(row.debit - row.credit);
    return {
      ...row,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? money(Math.abs(net)) : 0,
    };
  });
  const totalDebits = money(rows.reduce((sum, row) => sum + row.debit, 0));
  const totalCredits = money(rows.reduce((sum, row) => sum + row.credit, 0));
  return {
    rows,
    totalDebits,
    totalCredits,
    difference: money(totalDebits - totalCredits),
  };
}

export function profitAndLoss(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): ProfitAndLossReport {
  const rows = reportRows(accounts, journals);
  const revenue = rows.filter((row) => row.accountType === 'revenue');
  const expenses = rows.filter((row) => row.accountType === 'expense');
  const totalRevenue = money(revenue.reduce((sum, row) => sum + row.balance, 0));
  const totalExpenses = money(expenses.reduce((sum, row) => sum + row.balance, 0));
  return {
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: money(totalRevenue - totalExpenses),
  };
}

export function balanceSheet(
  accounts: readonly AccountRecord[],
  journals: readonly JournalRecord[],
): BalanceSheetReport {
  const rows = reportRows(accounts, journals);
  const assets = rows.filter((row) => row.accountType === 'asset');
  const liabilities = rows.filter((row) => row.accountType === 'liability');
  const equity = rows.filter((row) => row.accountType === 'equity');
  const totalAssets = money(assets.reduce((sum, row) => sum + row.balance, 0));
  const totalLiabilities = money(liabilities.reduce((sum, row) => sum + row.balance, 0));
  const totalEquity = money(equity.reduce((sum, row) => sum + row.balance, 0));
  const currentEarnings = profitAndLoss(accounts, journals).netIncome;
  const liabilitiesAndEquity = money(totalLiabilities + totalEquity + currentEarnings);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentEarnings,
    liabilitiesAndEquity,
    difference: money(totalAssets - liabilitiesAndEquity),
  };
}
