import { describe, expect, it } from 'vitest';
import {
  JournalWriteService,
  type CreatePostedJournalCommand,
  type JournalWriteGateway,
  type ReversePostedJournalCommand,
} from '../../packages/accounting/src';

const validCreate: CreatePostedJournalCommand = {
  organizationId: 'org-123',
  entryNumber: 'JE-1001',
  entryDate: '2026-09-03',
  memo: 'Monthly accrual',
  debitAccountId: 'account-debit',
  creditAccountId: 'account-credit',
  amount: 1250.5,
};

function gatewayWith(overrides: Partial<JournalWriteGateway> = {}): JournalWriteGateway {
  return {
    createBalancedJournalEntry: async () => 'journal-created',
    reversePostedJournalEntry: async () => 'journal-reversal',
    ...overrides,
  };
}

describe('JournalWriteService.createPostedJournal', () => {
  it('delegates a valid balanced entry to the governed backend operation', async () => {
    let received: CreatePostedJournalCommand | undefined;
    const service = new JournalWriteService(
      gatewayWith({
        createBalancedJournalEntry: async (command) => {
          received = command;
          return 'journal-1';
        },
      }),
    );

    await expect(service.createPostedJournal(validCreate)).resolves.toBe('journal-1');
    expect(received).toEqual(validCreate);
  });

  it('rejects non-positive amounts before a write is attempted', async () => {
    let calls = 0;
    const service = new JournalWriteService(
      gatewayWith({
        createBalancedJournalEntry: async () => {
          calls += 1;
          return 'unexpected';
        },
      }),
    );

    await expect(
      service.createPostedJournal({ ...validCreate, amount: 0 }),
    ).rejects.toThrow('Journal amount must be greater than zero');
    expect(calls).toBe(0);
  });

  it('rejects identical debit and credit accounts before a write is attempted', async () => {
    let calls = 0;
    const service = new JournalWriteService(
      gatewayWith({
        createBalancedJournalEntry: async () => {
          calls += 1;
          return 'unexpected';
        },
      }),
    );

    await expect(
      service.createPostedJournal({
        ...validCreate,
        creditAccountId: validCreate.debitAccountId,
      }),
    ).rejects.toThrow('Debit and credit accounts must differ');
    expect(calls).toBe(0);
  });

  it('requires organization, entry number and both account identifiers', async () => {
    const service = new JournalWriteService(gatewayWith());

    await expect(
      service.createPostedJournal({ ...validCreate, organizationId: ' ' }),
    ).rejects.toThrow('Organization is required');
    await expect(
      service.createPostedJournal({ ...validCreate, entryNumber: ' ' }),
    ).rejects.toThrow('Entry number is required');
    await expect(
      service.createPostedJournal({ ...validCreate, debitAccountId: ' ' }),
    ).rejects.toThrow('Debit account is required');
    await expect(
      service.createPostedJournal({ ...validCreate, creditAccountId: ' ' }),
    ).rejects.toThrow('Credit account is required');
  });
});

describe('JournalWriteService.reversePostedJournal', () => {
  const validReverse: ReversePostedJournalCommand = {
    organizationId: 'org-123',
    journalEntryId: 'journal-1',
    reversalEntryNumber: 'JE-1001-R1',
    reversalDate: '2026-09-03',
    reason: 'Accrual no longer required',
  };

  it('delegates reversal to the governed backend operation', async () => {
    let received: ReversePostedJournalCommand | undefined;
    const service = new JournalWriteService(
      gatewayWith({
        reversePostedJournalEntry: async (command) => {
          received = command;
          return 'journal-reversal-1';
        },
      }),
    );

    await expect(service.reversePostedJournal(validReverse)).resolves.toBe('journal-reversal-1');
    expect(received).toEqual(validReverse);
  });

  it('requires a reversal reason and identifiers before a write is attempted', async () => {
    let calls = 0;
    const service = new JournalWriteService(
      gatewayWith({
        reversePostedJournalEntry: async () => {
          calls += 1;
          return 'unexpected';
        },
      }),
    );

    await expect(
      service.reversePostedJournal({ ...validReverse, reason: ' ' }),
    ).rejects.toThrow('Reversal reason is required');
    await expect(
      service.reversePostedJournal({ ...validReverse, journalEntryId: ' ' }),
    ).rejects.toThrow('Journal entry is required');
    expect(calls).toBe(0);
  });
});
