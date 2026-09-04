import { describe, expect, test } from 'vitest';
import {
  SupabaseArApWriteGateway,
  type RecordInvoicePaymentCommand,
  type SetBillApprovalCommand,
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

describe('AR/AP Supabase RPC gateway', () => {
  test('maps invoice payment to the existing governed RPC', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseArApWriteGateway(clientWith({ data: 'payment-1', error: null }, calls) as never);
    const command: RecordInvoicePaymentCommand = {
      organizationId: 'org-1',
      invoiceId: 'invoice-1',
      amount: 125.5,
      paidOn: '2026-09-04',
    };

    await expect(gateway.recordInvoicePayment(command)).resolves.toBe('payment-1');
    expect(calls).toEqual([{
      name: 'record_invoice_payment',
      args: {
        invoice_uuid: 'invoice-1',
        payment_amount: 125.5,
        paid_on: '2026-09-04',
      },
    }]);
  });

  test('maps bill approval changes to the governed approval RPC', async () => {
    const calls: RpcCall[] = [];
    const gateway = new SupabaseArApWriteGateway(clientWith({ data: 'bill-1', error: null }, calls) as never);
    const command: SetBillApprovalCommand = {
      organizationId: 'org-1',
      billId: 'bill-1',
      approvalState: 'approved',
    };

    await expect(gateway.setBillApprovalState(command)).resolves.toBe('bill-1');
    expect(calls).toEqual([{
      name: 'set_accounting_bill_approval_state',
      args: {
        organization_uuid: 'org-1',
        bill_uuid: 'bill-1',
        approval_state: 'approved',
      },
    }]);
  });

  test('propagates RPC errors without fabricating success', async () => {
    const gateway = new SupabaseArApWriteGateway(clientWith({ data: null, error: { message: 'Accounting role required' } }, []) as never);

    await expect(gateway.recordInvoicePayment({
      organizationId: 'org-1',
      invoiceId: 'invoice-1',
      amount: 10,
      paidOn: '2026-09-04',
    })).rejects.toThrow('Accounting role required');
  });

  test('rejects a successful RPC response that does not contain a record id', async () => {
    const gateway = new SupabaseArApWriteGateway(clientWith({ data: null, error: null }, []) as never);

    await expect(gateway.setBillApprovalState({
      organizationId: 'org-1',
      billId: 'bill-1',
      approvalState: 'approved',
    })).rejects.toThrow('AR/AP write did not return an id');
  });
});
