import { describe, expect, test } from 'vitest';
import {
  AtlasRestAccountWriteGateway,
  AtlasRestArApWriteGateway,
  AtlasRestBankCashWriteGateway,
  AtlasRestGovernanceWriteGateway,
  AtlasRestJournalWriteGateway,
  type AtlasAccountingRpcCaller,
} from '../../apps/web/src/lib/accountingWriteGateway';

type RpcCall = { functionName: string; args: Record<string, unknown> };

function recordingRpc(result: unknown = 'result-id') {
  const calls: RpcCall[] = [];
  const rpc: AtlasAccountingRpcCaller = async <T>(functionName, args) => {
    calls.push({ functionName, args });
    return result as T;
  };
  return { calls, rpc };
}

describe('ATLAS Accounting governed REST RPC gateways', () => {
  test('maps a balanced journal to the existing governed journal RPC', async () => {
    const { calls, rpc } = recordingRpc('journal-1');
    const gateway = new AtlasRestJournalWriteGateway(rpc);

    await expect(gateway.createBalancedJournalEntry({
      organizationId: 'org-1',
      entryNumber: 'JE-1001',
      entryDate: '2026-09-11',
      memo: 'Accrual',
      debitAccountId: 'account-d',
      creditAccountId: 'account-c',
      amount: 125.25,
    })).resolves.toBe('journal-1');

    expect(calls).toEqual([{
      functionName: 'create_balanced_journal_entry',
      args: {
        organization_uuid: 'org-1',
        entry_code: 'JE-1001',
        entry_on: '2026-09-11',
        entry_memo: 'Accrual',
        debit_account_uuid: 'account-d',
        credit_account_uuid: 'account-c',
        entry_amount: 125.25,
      },
    }]);
  });

  test('maps Chart of Accounts writes to governed RPCs', async () => {
    const { calls, rpc } = recordingRpc('account-1');
    const gateway = new AtlasRestAccountWriteGateway(rpc);

    await gateway.createAccount({
      organizationId: 'org-1',
      accountNumber: '1000',
      name: 'Cash',
      accountType: 'asset',
    });

    expect(calls[0]).toEqual({
      functionName: 'create_chart_account',
      args: {
        organization_uuid: 'org-1',
        account_code: '1000',
        account_name: 'Cash',
        account_kind: 'asset',
      },
    });
  });

  test('maps AR/AP, reconciliation and accounting governance writes without direct table mutation', async () => {
    const { calls, rpc } = recordingRpc();

    await new AtlasRestArApWriteGateway(rpc).setBillApprovalState({
      organizationId: 'org-1', billId: 'bill-1', approvalState: 'approved',
    });
    await new AtlasRestBankCashWriteGateway(rpc).closeReconciliation({
      organizationId: 'org-1', sessionId: 'recon-1',
    });
    await new AtlasRestGovernanceWriteGateway(rpc).closeAccountingPeriod({
      organizationId: 'org-1', periodId: 'period-1',
    });

    expect(calls.map((call) => call.functionName)).toEqual([
      'set_accounting_bill_approval_state',
      'close_accounting_reconciliation',
      'close_accounting_period',
    ]);
  });

  test('rejects a governed RPC response that does not return an id', async () => {
    const { rpc } = recordingRpc(null);
    const gateway = new AtlasRestJournalWriteGateway(rpc);

    await expect(gateway.reversePostedJournalEntry({
      organizationId: 'org-1',
      journalEntryId: 'journal-1',
      reversalEntryNumber: 'JE-1001-R1',
      reversalDate: '2026-09-11',
      reason: 'Reverse accrual',
    })).rejects.toThrow('Accounting write did not return an id');
  });
});
