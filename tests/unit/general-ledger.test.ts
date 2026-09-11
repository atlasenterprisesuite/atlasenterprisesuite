import { describe, expect, test } from 'vitest';
import {
  buildGeneralLedger,
  type AccountRecord,
  type JournalRecord,
} from '../../packages/accounting/src';

const accounts: AccountRecord[] = [
  {
    id: 'cash',
    organizationId: 'org-test',
    accountNumber: '1000',
    name: 'Cash',
    accountType: 'asset',
    createdAt: null,
    updatedAt: null,
  },
  {
    id: 'revenue',
    organizationId: 'org-test',
    accountNumber: '4000',
    name: 'Revenue',
    accountType: 'revenue',
    createdAt: null,
    updatedAt: null,
  },
];

function postedJournal(overrides: Partial<JournalRecord> = {}): JournalRecord {
  return {
    id: 'journal-1',
    organizationId: 'org-test',
    entryNumber: 'JE-1001',
    entryDate: '2026-09-03',
    memo: 'Cash sale',
    status: 'posted',
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    reversesJournalEntryId: null,
    lines: [
      {
        id: 'line-1',
        organizationId: 'org-test',
        journalEntryId: 'journal-1',
        accountId: 'cash',
        debit: 250,
        credit: 0,
        createdAt: null,
      },
      {
        id: 'line-2',
        organizationId: 'org-test',
        journalEntryId: 'journal-1',
        accountId: 'revenue',
        debit: 0,
        credit: 250,
        createdAt: null,
      },
    ],
    ...overrides,
  };
}

describe('buildGeneralLedger', () => {
  test('uses only posted journal lines and maps real account metadata', () => {
    const draft = postedJournal({ id: 'draft', entryNumber: 'JE-DRAFT', status: 'draft' });
    const rows = buildGeneralLedger(accounts, [draft, postedJournal()]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.entryNumber)).toEqual(['JE-1001', 'JE-1001']);
    expect(rows[0]).toMatchObject({
      accountId: 'cash',
      accountNumber: '1000',
      accountName: 'Cash',
      debit: 250,
      credit: 0,
      runningNet: 250,
    });
    expect(rows[1]).toMatchObject({
      accountId: 'revenue',
      accountNumber: '4000',
      accountName: 'Revenue',
      debit: 0,
      credit: 250,
      runningNet: -250,
    });
  });

  test('sorts by entry date, entry number, then line id before running balances', () => {
    const later = postedJournal({
      id: 'journal-2',
      entryNumber: 'JE-1002',
      entryDate: '2026-09-04',
      lines: [{
        id: 'line-3',
        organizationId: 'org-test',
        journalEntryId: 'journal-2',
        accountId: 'cash',
        debit: 10,
        credit: 0,
        createdAt: null,
      }],
    });

    const rows = buildGeneralLedger(accounts, [later, postedJournal()]);
    const cashRows = rows.filter((row) => row.accountId === 'cash');

    expect(cashRows.map((row) => row.entryNumber)).toEqual(['JE-1001', 'JE-1002']);
    expect(cashRows.map((row) => row.runningNet)).toEqual([250, 260]);
  });

  test('preserves a ledger line with unresolved account metadata instead of fabricating a name', () => {
    const journal = postedJournal({
      lines: [{
        id: 'line-missing',
        organizationId: 'org-test',
        journalEntryId: 'journal-1',
        accountId: 'missing-account',
        debit: 5,
        credit: 0,
        createdAt: null,
      }],
    });

    expect(buildGeneralLedger(accounts, [journal])[0]).toMatchObject({
      accountId: 'missing-account',
      accountNumber: null,
      accountName: null,
    });
  });

  test('returns a true empty ledger when there are no posted journal lines', () => {
    expect(buildGeneralLedger(accounts, [])).toEqual([]);
  });
});
