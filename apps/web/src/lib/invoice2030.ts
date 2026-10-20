import type { LiveReceivablesLedger } from './receivablesApi';

/**
 * Read-only presentation projection for the canonical receivables subledger.
 * This module NEVER changes accounting, inventory, or payment state.
 */
export type Invoice2030Item = {
  id: string;
  sku: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxPercent: number;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type Invoice2030Model = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  items: Invoice2030Item[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  balanceMinor: number;
  paidMinor: number;
  currency: 'USD';
  isDraft: boolean;
};

function assertMinor(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) ||
      Math.abs(value * 100) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`invoice_2030_invalid_${field}`);
  }
  return Math.round(value * 100);
}

export function buildInvoice2030Model(ledger: LiveReceivablesLedger, invoiceId: string): Invoice2030Model {
  if (ledger.source !== 'supabase_rls_live' || !ledger.organization.id) {
    throw new Error('invoice_2030_verified_organization_required');
  }
  const invoice = ledger.invoices.find((item) => item.id === invoiceId);
  if (!invoice || invoice.org_id !== ledger.organization.id) {
    throw new Error('invoice_2030_invoice_scope_mismatch');
  }
  if (!invoice.invoice_number.trim()) throw new Error('invoice_2030_number_required');
  const customer = ledger.customers.find((item) => item.id === invoice.customer_id);
  if (!customer || customer.org_id !== ledger.organization.id) {
    throw new Error('invoice_2030_customer_scope_mismatch');
  }
  const lines = ledger.lines.filter((line) => line.invoice_id === invoice.id);
  if (lines.some((line) => line.org_id !== ledger.organization.id)) {
    throw new Error('invoice_2030_line_scope_mismatch');
  }
  if (!lines.length) throw new Error('invoice_2030_lines_required');

  const items: Invoice2030Item[] = lines.map((line) => {
    if (!line.description.trim() || !Number.isFinite(line.quantity) || line.quantity <= 0 ||
        !Number.isFinite(line.tax_rate) || line.tax_rate < 0 || line.tax_rate > 100) {
      throw new Error('invoice_2030_invalid_line');
    }
    const unitPriceMinor = assertMinor(line.unit_price, 'unit_price');
    const netMinor = assertMinor(line.quantity * line.unit_price, 'line_amount');
    // Match canonical SQL: tax rounds from the unrounded extended price per line.
    const taxMinor = assertMinor(line.quantity * line.unit_price * line.tax_rate / 100, 'line_tax');
    const product = ledger.products.find((entry) => entry.id === line.product_id);
    if (product && product.org_id !== ledger.organization.id) {
      throw new Error('invoice_2030_product_scope_mismatch');
    }
    return {
      id: line.id,
      sku: product?.sku || null,
      description: line.description,
      quantity: line.quantity,
      unitPriceMinor,
      taxPercent: line.tax_rate,
      netMinor,
      taxMinor,
      totalMinor: netMinor + taxMinor
    };
  });

  const subtotalMinor = items.reduce((sum, line) => sum + line.netMinor, 0);
  const taxMinor = items.reduce((sum, line) => sum + line.taxMinor, 0);
  const totalMinor = assertMinor(invoice.total, 'total');
  const balanceMinor = assertMinor(invoice.balance_due, 'balance');
  if (subtotalMinor + taxMinor !== totalMinor) {
    throw new Error('invoice_2030_ledger_total_mismatch');
  }
  if (balanceMinor > totalMinor) throw new Error('invoice_2030_balance_exceeds_total');

  // Payments are NOT re-posted or inferred from processing messages. The ledger balance wins.
  // Existing refunds/credits can change paid balance without changing this visual projection.
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    items,
    subtotalMinor,
    taxMinor,
    totalMinor,
    balanceMinor,
    paidMinor: totalMinor - balanceMinor,
    currency: 'USD',
    isDraft: invoice.status === 'draft'
  };
}

export function formatInvoice2030Money(minor: number, language: 'en' | 'es' = 'en') {
  if (!Number.isSafeInteger(minor)) throw new Error('invoice_2030_invalid_money');
  return new Intl.NumberFormat(language === 'es' ? 'es-US' : 'en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(minor / 100);
}
