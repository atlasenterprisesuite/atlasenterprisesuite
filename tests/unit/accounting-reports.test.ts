import { describe, expect, it } from 'vitest';
import {
  balanceSheet,
  profitAndLoss,
  trialBalance,
  type AccountRecord,
  type JournalRecord,
} from '../../packages/accounting/src';

const accounts: AccountRecord[] = [
  { id: 'cash', organizationId: 'org-1', accountNumber: '1000', name: 'Cash', accountType: 'asset', active: true, createdAt: null, updatedAt: null },
  { id: 'payable', organizationId: 'org-1', accountNumber: '2000', name: 'Accounts Payable', accountType: 'liability', active: true, createdAt: null, updatedAt: null },
  { id: 'equity', organizationId: 'org-1', accountNumber: '3000', name: 'Owner Equity', accountType: 'equity', active: true, createdAt: null, updatedAt: null },
  { id: 'revenue', organizationId: 'org-1', accountNumber: '4000', name: 'Service Revenue', accountType: 'revenue', active: true, createdAt: null, updatedAt: null },
  { id: 'expense', organizationId: 'org-1', accountNumber: '5000', name: 'Operating Expense', accountType: 'expense', active: true, createdAt: null, updatedAt: null },
];

function journal(id: string, status: string, lines: JournalRecord['lines']): JournalRecord {
  return {
    id,
    organizationId: 'org-1',
    entryNumber: id.toUpperCase(),
    entryDate: '2026-09-01',
    memo: null,
    status,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    reversesJournalEntryId: null,
    lines,
  };
}

const posted: JournalRecord[] = [
  journal('j1', 'posted', [
    { id: 'l1', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'cash', debit: 1000, credit: 0, createdAt: null },
    { id: 'l2', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'revenue', debit: 0, credit: 1000, createdAt: null },
  ]),
  journal('j2', 'posted', [
    { id: 'l3', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'expense', debit: 250, credit: 0, createdAt: null },
    { id: 'l4', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'cash', debit: 0, credit: 250, createdAt: null },
  ]),
  journal('draft', 'draft', [
    { id: 'l5', organizationId: 'org-1', journalEntryId: 'draft', accountId: 'cash', debit: 9999, credit: 0, createdAt: null },
    { id: 'l6', organizationId: 'org-1', journalEntryId: 'draft', accountId: 'equity', debit: 0, credit: 9999, createdAt: null },
  ]),
];

describe('financial reports', () => {
  it('builds a balanced trial balance from posted journals only', () => {
    const report = trialBalance(accounts, posted);
    expect(report.totalDebits).toBe(1250);
    expect(report.totalCredits).toBe(1250);
    expect(report.balanced).toBe(true);
    expect(report.rows.find((row) => row.accountId === 'cash')?.balance).toBe(750);
  });

  it('derives profit and loss from revenue and expense account types', () => {
    const report = profitAndLoss(accounts, posted);
    expect(report.totalRevenue).toBe(1000);
    expect(report.totalExpenses).toBe(250);
    expect(report.netIncome).toBe(750);
  });

  it('derives a balanced balance sheet including current earnings', () => {
    const report = balanceSheet(accounts, posted);
    expect(report.totalAssets).toBe(750);
    expect(report.totalLiabilities).toBe(0);
    expect(report.totalEquity).toBe(0);
    expect(report.currentEarnings).toBe(750);
    expect(report.balanced).toBe(true);
  });
});
