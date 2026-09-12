import { describe, expect, test } from 'vitest';
import { validateJournalLines } from '../../packages/accounting/src';

describe('journal validation', () => {
  test('accepts a balanced double-entry journal', () => {
    const result = validateJournalLines([
      { accountId: 'cash-account', debit: 100, credit: 0 },
      { accountId: 'revenue-account', debit: 0, credit: 100 },
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(100);
  });

  test('rejects a line with both debit and credit', () => {
    const result = validateJournalLines([
      { accountId: 'cash-account', debit: 50, credit: 50 },
      { accountId: 'revenue-account', debit: 0, credit: 50 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Each journal line must contain either a debit or a credit, not both.');
  });

  test('rejects negative amounts', () => {
    const result = validateJournalLines([
      { accountId: 'cash-account', debit: -10, credit: 0 },
      { accountId: 'revenue-account', debit: 0, credit: 10 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Journal amounts cannot be negative.');
  });

  test('rejects a line with no amount', () => {
    const result = validateJournalLines([
      { accountId: 'cash-account', debit: 0, credit: 0 },
      { accountId: 'revenue-account', debit: 0, credit: 10 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Each journal line must contain a debit or a credit amount greater than zero.');
  });

  test('rejects an unbalanced journal', () => {
    const result = validateJournalLines([
      { accountId: 'cash-account', debit: 100, credit: 0 },
      { accountId: 'revenue-account', debit: 0, credit: 99.99 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Journal debits and credits must balance.');
  });
});
