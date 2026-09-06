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
  { id: 'ap', organizationId: 'org-1', accountNumber: '2000', name: 'Accounts Payable', accountType: 'liability', active: true, createdAt: null, updatedAt: null },
  { id: 'equity', organizationId: 'org-1', accountNumber: '3000', name: 'Owner Equity', accountType: 'equity', active: true, createdAt: null, updatedAt: null },
  { id: 'sales', organizationId: 'org-1', accountNumber: '4000', name: 'Sales', accountType: 'revenue', active: true, createdAt: null, updatedAt: null },
  { id: 'expense', organizationId: 'org-1', accountNumber: '5000', name: 'Supplies Expense', accountType: 'expense', active: true, createdAt: null, updatedAt: null },
];

const journals: JournalRecord[] = [
  {
    id: 'j1', organizationId: 'org-1', entryNumber: 'J-1', entryDate: '2026-01-01', memo: 'Capital', status: 'posted', createdBy: 'u1', createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l1', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'cash', debit: 1000, credit: 0, createdAt: null },
      { id: 'l2', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'equity', debit: 0, credit: 1000, createdAt: null },
    ],
  },
  {
    id: 'j2', organizationId: 'org-1', entryNumber: 'J-2', entryDate: '2026-02-01', memo: 'Sale', status: 'posted', createdBy: 'u1', createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l3', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'cash', debit: 100, credit: 0, createdAt: null },
      { id: 'l4', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'sales', debit: 0, credit: 100, createdAt: null },
    ],
  },
  {
    id: 'j3', organizationId: 'org-1', entryNumber: 'J-3', entryDate: '2026-02-02', memo: 'Supplies', status: 'posted', createdBy: 'u1', createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l5', organizationId: 'org-1', journalEntryId: 'j3', accountId: 'expense', debit: 40, credit: 0, createdAt: null },
      { id: 'l6', organizationId: 'org-1', journalEntryId: 'j3', accountId: 'cash', debit: 0, credit: 40, createdAt: null },
    ],
  },
  {
    id: 'j4', organizationId: 'org-1', entryNumber: 'J-4', entryDate: '2026-02-03', memo: 'Draft ignored', status: 'draft', createdBy: 'u1', createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l7', organizationId: 'org-1', journalEntryId: 'j4', accountId: 'cash', debit: 999, credit: 0, createdAt: null },
      { id: 'l8', organizationId: 'org-1', journalEntryId: 'j4', accountId: 'sales', debit: 0, credit: 999, createdAt: null },
    ],
  },
];

describe('ATLAS Accounting reports', () => {
  it('builds a balanced trial balance from posted journals only', () => {
    const report = trialBalance(accounts, journals);
    expect(report.totalDebits).toBe(1140);
    expect(report.totalCredits).toBe(1140);
    expect(report.difference).toBe(0);
  });

  it('computes profit and loss from revenue and expense accounts', () => {
    const report = profitAndLoss(accounts, journals);
    expect(report.totalRevenue).toBe(100);
    expect(report.totalExpenses).toBe(40);
    expect(report.netIncome).toBe(60);
  });

  it('balances assets against liabilities, equity, and current earnings', () => {
    const report = balanceSheet(accounts, journals);
    expect(report.totalAssets).toBe(1060);
    expect(report.totalLiabilities).toBe(0);
    expect(report.totalEquity).toBe(1000);
    expect(report.currentEarnings).toBe(60);
    expect(report.difference).toBe(0);
  });
});
