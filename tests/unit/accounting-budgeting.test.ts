import { describe, expect, test } from 'vitest';
import { budgetVsActual, type AccountRecord, type BudgetLineRecord, type JournalRecord } from '../../packages/accounting/src';

const accounts: AccountRecord[] = [
  { id: 'cash', organizationId: 'org-1', accountNumber: '1000', name: 'Cash', accountType: 'asset', active: true, createdAt: null, updatedAt: null },
  { id: 'sales', organizationId: 'org-1', accountNumber: '4000', name: 'Sales', accountType: 'revenue', active: true, createdAt: null, updatedAt: null },
  { id: 'rent', organizationId: 'org-1', accountNumber: '6100', name: 'Rent', accountType: 'expense', active: true, createdAt: null, updatedAt: null },
];

const budgets: BudgetLineRecord[] = [
  { id: 'b-sales', organizationId: 'org-1', budgetId: 'budget-1', accountId: 'sales', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 10000, dimension: {}, note: null },
  { id: 'b-rent', organizationId: 'org-1', budgetId: 'budget-1', accountId: 'rent', periodStart: '2026-09-01', periodEnd: '2026-09-30', amount: 3000, dimension: {}, note: null },
];

const journals: JournalRecord[] = [
  {
    id: 'j1', organizationId: 'org-1', entryNumber: 'JE-1', entryDate: '2026-09-10', memo: null, status: 'posted', createdBy: null, createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l1', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'cash', debit: 9000, credit: 0, createdAt: null },
      { id: 'l2', organizationId: 'org-1', journalEntryId: 'j1', accountId: 'sales', debit: 0, credit: 9000, createdAt: null },
    ],
  },
  {
    id: 'j2', organizationId: 'org-1', entryNumber: 'JE-2', entryDate: '2026-09-15', memo: null, status: 'posted', createdBy: null, createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [
      { id: 'l3', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'rent', debit: 3200, credit: 0, createdAt: null },
      { id: 'l4', organizationId: 'org-1', journalEntryId: 'j2', accountId: 'cash', debit: 0, credit: 3200, createdAt: null },
    ],
  },
  {
    id: 'draft', organizationId: 'org-1', entryNumber: 'JE-D', entryDate: '2026-09-20', memo: null, status: 'draft', createdBy: null, createdAt: null, updatedAt: null, reversesJournalEntryId: null,
    lines: [{ id: 'ld', organizationId: 'org-1', journalEntryId: 'draft', accountId: 'sales', debit: 0, credit: 50000, createdAt: null }],
  },
];

describe('budgetVsActual', () => {
  test('normalizes revenue and expense signs and excludes non-posted journals', () => {
    expect(budgetVsActual(accounts, budgets, journals)).toEqual([
      {
        accountId: 'sales', accountNumber: '4000', accountName: 'Sales', accountType: 'revenue',
        budget: 10000, actual: 9000, variance: -1000, variancePct: -10,
      },
      {
        accountId: 'rent', accountNumber: '6100', accountName: 'Rent', accountType: 'expense',
        budget: 3000, actual: 3200, variance: 200, variancePct: 6.67,
      },
    ]);
  });
});
