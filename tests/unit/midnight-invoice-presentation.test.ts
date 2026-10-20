import { describe, expect, it } from 'vitest';
import { buildMidnightInvoice } from '../../apps/web/src/modules/finance/accounting/midnightInvoice';
import type { LiveReceivablesLedger } from '../../apps/web/src/lib/receivablesApi';

function fixture(): LiveReceivablesLedger {
  return {
    source: 'supabase_rls_live',
    organization: { id: 'org-a', role: 'owner' },
    customers: [{ id: 'customer-a', org_id: 'org-a', name: 'Client A', email: null, phone: null, status: 'active' }],
    invoices: [{
      id: 'invoice-a', org_id: 'org-a', customer_id: 'customer-a',
      invoice_number: 'INV-100', issue_date: '2026-10-20', due_date: '2026-11-20',
      total: 107, balance_due: 107, status: 'open', inventory_posted_at: null,
      cogs_amount: null, gross_profit: null, gross_margin_pct: null,
      created_at: '', updated_at: ''
    }],
    lines: [{ id: 'line-a', org_id: 'org-a', invoice_id: 'invoice-a', product_id: null,
      description: 'Accounting service', quantity: 2, unit_price: 50, tax_rate: 7 }],
    payments: [], products: [], locations: [], loaded_at: '2026-10-20T07:00:00.000Z'
  };
}

describe('Midnight Tech invoice print model / modelo de impresión', () => {
  it('reconciles a bilingual invoice to canonical invoice totals without posting to the ledger', () => {
    const model = buildMidnightInvoice(fixture(), 'invoice-a');
    expect(model.documentTitle).toBe('INVOICE / FACTURA');
    expect(model.customerName).toBe('Client A');
    expect(model.totalCents).toBe(10700);
    expect(model.balanceCents).toBe(10700);
    expect(model.lines[0].lineTotalCents).toBe(10700);
    expect(model.lines[0].description).toBe('Accounting service');
    expect(model.paymentEnabled).toBe(false);
    expect(model.signed).toBe(false);
  });

  it('clearly identifies draft invoices as unissued', () => {
    const ledger = fixture();
    ledger.invoices[0].status = 'draft';
    const model = buildMidnightInvoice(ledger, 'invoice-a');
    expect(model.warning).toMatch(/DRAFT \/ BORRADOR/);
    expect(model.signed).toBe(false);
  });

  it('marks cancelled invoices as not payable', () => {
    const ledger = fixture();
    ledger.invoices[0].status = 'cancelled';
    expect(buildMidnightInvoice(ledger, 'invoice-a').warning).toContain('NOT PAYABLE / NO PAGAR');
  });

  it('fails closed if the invoice or customer is not in the active tenant', () => {
    const ledger = fixture();
    ledger.lines[0].org_id = 'org-other';
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_tenant_mismatch');
    ledger.lines[0].org_id = 'org-a';
    ledger.customers[0].org_id = 'org-other';
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_tenant_mismatch');
  });

  it('blocks inconsistent totals and missing customer rather than printing misleading financial facts', () => {
    const ledger = fixture();
    ledger.invoices[0].total = 106;
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_total_mismatch');
    ledger.invoices[0].total = 107;
    ledger.customers = [];
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_customer_missing');
  });

  it('rejects invalid financial data and out-of-range balances', () => {
    const ledger = fixture();
    ledger.lines[0].quantity = -1;
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_line_invalid');
    ledger.lines[0].quantity = 2;
    ledger.invoices[0].balance_due = 108;
    expect(() => buildMidnightInvoice(ledger, 'invoice-a')).toThrow('invoice_balance_invalid');
  });
});
