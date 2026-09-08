import { describe, expect, it } from 'vitest';
import {
  SupabaseAccountingWriteGateway,
  type CreatePostedJournalCommand,
  type ReversePostedJournalCommand,
} from '../../packages/accounting/src';

type RpcCall = { functionName: string; args: Record<string, unknown> };

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: RpcCall[] = [];
  return {
    calls,
    client: {
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        calls.push({ functionName, args });
        return result;
      },
    },
  };
}

describe('SupabaseAccountingWriteGateway', () => {
  it('maps balanced journal creation to the existing governed RPC', async () => {
    const { client, calls } = fakeClient({ data: 'journal-1', error: null });
    const gateway = new SupabaseAccountingWriteGateway(client as never);
    const command: CreatePostedJournalCommand = {
      organizationId: 'org-1',
      entryNumber: 'JE-1001',
      entryDate: '2026-09-03',
      memo: 'Accrual',
      debitAccountId: 'account-d',
      creditAccountId: 'account-c',
      amount: 125.25,
    };

    await expect(gateway.createBalancedJournalEntry(command)).resolves.toBe('journal-1');
    expect(calls).toEqual([
      {
        functionName: 'create_balanced_journal_entry',
        args: {
          organization_uuid: 'org-1',
          entry_code: 'JE-1001',
          entry_on: '2026-09-03',
          entry_memo: 'Accrual',
          debit_account_uuid: 'account-d',
          credit_account_uuid: 'account-c',
          entry_amount: 125.25,
        },
      },
    ]);
  });

  it('maps reversal to the governed reversal RPC', async () => {
    const { client, calls } = fakeClient({ data: 'journal-r1', error: null });
    const gateway = new SupabaseAccountingWriteGateway(client as never);
    const command: ReversePostedJournalCommand = {
      organizationId: 'org-1',
      journalEntryId: 'journal-1',
      reversalEntryNumber: 'JE-1001-R1',
      reversalDate: '2026-09-03',
      reason: 'Accrual reversed',
    };

    await expect(gateway.reversePostedJournalEntry(command)).resolves.toBe('journal-r1');
    expect(calls).toEqual([
      {
        functionName: 'reverse_posted_journal_entry',
        args: {
          organization_uuid: 'org-1',
          journal_uuid: 'journal-1',
          reversal_code: 'JE-1001-R1',
          reversal_on: '2026-09-03',
          reversal_reason: 'Accrual reversed',
        },
      },
    ]);
  });

  it('surfaces backend authorization or validation errors without inventing success', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'Accounting role required' } });
    const gateway = new SupabaseAccountingWriteGateway(client as never);

    await expect(
      gateway.createBalancedJournalEntry({
        organizationId: 'org-1',
        entryNumber: 'JE-1002',
        entryDate: null,
        memo: null,
        debitAccountId: 'account-d',
        creditAccountId: 'account-c',
        amount: 10,
      }),
    ).rejects.toThrow('Accounting role required');
  });

  it('rejects a successful RPC response that does not return a journal id', async () => {
    const { client } = fakeClient({ data: null, error: null });
    const gateway = new SupabaseAccountingWriteGateway(client as never);

    await expect(
      gateway.reversePostedJournalEntry({
        organizationId: 'org-1',
        journalEntryId: 'journal-1',
        reversalEntryNumber: 'JE-1001-R1',
        reversalDate: null,
        reason: 'Reverse',
      }),
    ).rejects.toThrow('Journal write did not return an id');
  });
});
