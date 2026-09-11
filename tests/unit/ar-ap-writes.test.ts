import { describe, expect, test } from 'vitest';
import {
  ArApWriteService,
  type ArApWriteGateway,
  type RecordInvoicePaymentCommand,
  type SetBillApprovalCommand,
} from '../../packages/accounting/src';

function gatewayWith(overrides: Partial<ArApWriteGateway> = {}): ArApWriteGateway {
  return {
    recordInvoicePayment: async () => 'payment-1',
    setBillApprovalState: async () => 'bill-1',
    ...overrides,
  };
}

describe('AR/AP write contracts', () => {
  test('records a positive invoice payment through the governed gateway', async () => {
    let received: RecordInvoicePaymentCommand | undefined;
    const service = new ArApWriteService(gatewayWith({
      recordInvoicePayment: async (command) => {
        received = command;
        return 'payment-1';
      },
    }));

    await expect(service.recordInvoicePayment({
      organizationId: 'org-test',
      invoiceId: 'invoice-1',
      amount: 125.5,
      paidOn: '2026-09-04',
    })).resolves.toBe('payment-1');

    expect(received).toEqual({
      organizationId: 'org-test',
      invoiceId: 'invoice-1',
      amount: 125.5,
      paidOn: '2026-09-04',
    });
  });

  test('rejects invalid invoice payment commands before the gateway', async () => {
    const service = new ArApWriteService(gatewayWith());

    await expect(service.recordInvoicePayment({
      organizationId: 'org-test',
      invoiceId: '',
      amount: 10,
      paidOn: '2026-09-04',
    })).rejects.toThrow('Invoice is required');

    await expect(service.recordInvoicePayment({
      organizationId: 'org-test',
      invoiceId: 'invoice-1',
      amount: 0,
      paidOn: '2026-09-04',
    })).rejects.toThrow('Payment amount must be greater than zero');

    await expect(service.recordInvoicePayment({
      organizationId: 'org-test',
      invoiceId: 'invoice-1',
      amount: 10,
      paidOn: 'not-a-date',
    })).rejects.toThrow('Payment date must be YYYY-MM-DD');
  });

  test('sets only supported bill approval states through the governed gateway', async () => {
    let received: SetBillApprovalCommand | undefined;
    const service = new ArApWriteService(gatewayWith({
      setBillApprovalState: async (command) => {
        received = command;
        return command.billId;
      },
    }));

    await expect(service.setBillApprovalState({
      organizationId: 'org-test',
      billId: 'bill-1',
      approvalState: 'approved',
    })).resolves.toBe('bill-1');

    expect(received).toEqual({
      organizationId: 'org-test',
      billId: 'bill-1',
      approvalState: 'approved',
    });
  });

  test('rejects unsupported bill approval states before the gateway', async () => {
    const service = new ArApWriteService(gatewayWith());

    await expect(service.setBillApprovalState({
      organizationId: 'org-test',
      billId: 'bill-1',
      approvalState: 'paid' as never,
    })).rejects.toThrow('Unsupported bill approval state');
  });
});
