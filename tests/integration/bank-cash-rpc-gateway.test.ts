import { describe, expect, test } from 'vitest';
import {
  SupabaseBankCashWriteGateway,
  type CloseReconciliationCommand,
  type ResolveReconciliationItemCommand,
  type StartReconciliationCommand,
} from '../../packages/accounting/src';

type RpcCall = { name: string; args: Record<string, unknown> };

function clientWith(result: { data: unknown; error: { message: string } | null }, calls: RpcCall[]) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
  };
}

describe('Bank & Cash Supabase RPC gateway', () => {
  test('maps start reconciliation to the governed RPC', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseBankCashWriteGateway(clientWith({ data: 'session-1', error: null }, calls) as never);
    const command: StartReconciliationCommand = {
      organizationId: 'org-1', bankAccountId: 'bank-1', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      statementEndingBalance: 1200, ledgerEndingBalance: 1200,
    };

    await expect(gateway.startReconciliation(command)).resolves.toBe('session-1');
    expect(calls).toEqual([{ name: 'start_accounting_reconciliation', args: {
      organization_uuid: 'org-1', bank_account_uuid: 'bank-1', period_start_date: '2026-08-01', period_end_date: '2026-08-31',
      statement_balance: 1200, ledger_balance: 1200,
    } }]);
  });

  test('maps resolve item and close session RPCs', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseBankCashWriteGateway(clientWith({ data: 'record-1', error: null }, calls) as never);
    const item: ResolveReconciliationItemCommand = {
      organizationId: 'org-1', itemId: 'item-1', status: 'resolved', matchType: 'matched', variance: 0, note: null,
    };
    const close: CloseReconciliationCommand = { organizationId: 'org-1', sessionId: 'session-1' };

    await gateway.resolveReconciliationItem(item);
    await gateway.closeReconciliation(close);

    expect(calls[0]).toEqual({ name: 'resolve_accounting_reconciliation_item', args: {
      organization_uuid: 'org-1', item_uuid: 'item-1', item_status: 'resolved', item_match_type: 'matched', item_variance: 0, item_note: null,
    } });
    expect(calls[1]).toEqual({ name: 'close_accounting_reconciliation', args: {
      organization_uuid: 'org-1', session_uuid: 'session-1',
    } });
  });

  test('propagates RPC errors and rejects missing ids', async () => {
    const gatewayError = new SupabaseBankCashWriteGateway(clientWith({ data: null, error: { message: 'blocked' } }, []) as never);
    await expect(gatewayError.closeReconciliation({ organizationId: 'org-1', sessionId: 'session-1' })).rejects.toThrow('blocked');

    const gatewayMissingId = new SupabaseBankCashWriteGateway(clientWith({ data: null, error: null }, []) as never);
    await expect(gatewayMissingId.closeReconciliation({ organizationId: 'org-1', sessionId: 'session-1' })).rejects.toThrow('Bank/Cash write did not return an id');
  });
});
