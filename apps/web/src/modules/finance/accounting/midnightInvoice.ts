import type { LiveReceivablesLedger } from '../../../lib/receivablesApi';

export type MidnightInvoiceLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotalCents: number;
};

export type MidnightInvoice = {
  invoiceNumber: string;
  documentTitle: 'INVOICE / FACTURA';
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  currency: 'USD';
  totalCents: number;
  balanceCents: number;
  lines: MidnightInvoiceLine[];
  warning: string | null;
  paymentEnabled: false;
  signed: false;
};

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('invoice_amount_invalid');
  const rounded = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(rounded)) throw new Error('invoice_amount_invalid');
  return rounded;
}

/**
 * Pure print-only projection of the existing RLS-scoped Receivables ledger.
 * No writes, posting, token generation, payment-provider access or signature claims.
 * USD reflects the currency of the existing AR workspace, not multi-currency support.
 */
export function buildMidnightInvoice(ledger: LiveReceivablesLedger, invoiceId: string): MidnightInvoice {
  const orgId = ledger.organization.id;
  const invoice = ledger.invoices.find((item) => item.id === invoiceId);
  if (!invoice || invoice.org_id !== orgId) throw new Error('invoice_tenant_mismatch');
  if (!invoice.invoice_number.trim() || !invoice.issue_date) throw new Error('invoice_identity_missing');

  const customer = ledger.customers.find((item) => item.id === invoice.customer_id);
  if (!customer) throw new Error('invoice_customer_missing');
  if (customer.org_id !== orgId) throw new Error('invoice_tenant_mismatch');
  if (!customer.name.trim()) throw new Error('invoice_customer_missing');

  const rawLines = ledger.lines.filter((line) => line.invoice_id === invoiceId);
  if (!rawLines.length) throw new Error('invoice_lines_missing');
  const lines = rawLines.map((line): MidnightInvoiceLine => {
    if (line.org_id !== orgId) throw new Error('invoice_tenant_mismatch');
    if (!line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0
      || !Number.isFinite(line.unit_price) || line.unit_price < 0
      || !Number.isFinite(line.tax_rate) || line.tax_rate < 0 || line.tax_rate > 100) {
      throw new Error('invoice_line_invalid');
    }
    const subtotal = cents(line.quantity * line.unit_price);
    const tax = cents((line.quantity * line.unit_price) * line.tax_rate / 100);
    return {
      id: line.id,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unit_price,
      taxRate: line.tax_rate,
      lineTotalCents: subtotal + tax
    };
  });

  const totalCents = cents(invoice.total);
  const balanceCents = cents(invoice.balance_due);
  const lineTotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (Math.abs(lineTotalCents - totalCents) > 1) throw new Error('invoice_total_mismatch');
  if (balanceCents > totalCents) throw new Error('invoice_balance_invalid');

  return {
    invoiceNumber: invoice.invoice_number,
    documentTitle: 'INVOICE / FACTURA',
    customerName: customer.name,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    status: invoice.status,
    currency: 'USD',
    totalCents,
    balanceCents,
    lines,
    warning: invoice.status === 'draft'
      ? 'DRAFT / BORRADOR — NOT ISSUED / NO EMITIDA'
      : invoice.status === 'cancelled'
        ? 'CANCELLED / ANULADA — NOT PAYABLE / NO PAGAR'
        : null,
    paymentEnabled: false,
    signed: false
  };
}
