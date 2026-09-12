export type RecordInvoicePaymentCommand = {
  organizationId: string;
  invoiceId: string;
  amount: number;
  paidOn: string;
};

export type BillApprovalState = 'pending' | 'approved' | 'rejected';

export type SetBillApprovalCommand = {
  organizationId: string;
  billId: string;
  approvalState: BillApprovalState;
};

export interface ArApWriteGateway {
  recordInvoicePayment(command: RecordInvoicePaymentCommand): Promise<string>;
  setBillApprovalState(command: SetBillApprovalCommand): Promise<string>;
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function requireDateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error('Payment date must be YYYY-MM-DD');
  }
  return value;
}

export class ArApWriteService {
  constructor(private readonly gateway: ArApWriteGateway) {}

  async recordInvoicePayment(command: RecordInvoicePaymentCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const invoiceId = requireText(command.invoiceId, 'Invoice is required');
    const amount = Number(command.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    const paidOn = requireDateOnly(command.paidOn);

    return this.gateway.recordInvoicePayment({
      organizationId,
      invoiceId,
      amount,
      paidOn,
    });
  }

  async setBillApprovalState(command: SetBillApprovalCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const billId = requireText(command.billId, 'Bill is required');
    const allowed: readonly BillApprovalState[] = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(command.approvalState as BillApprovalState)) {
      throw new Error('Unsupported bill approval state');
    }

    return this.gateway.setBillApprovalState({
      organizationId,
      billId,
      approvalState: command.approvalState,
    });
  }
}
