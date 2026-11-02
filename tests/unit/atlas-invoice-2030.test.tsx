import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveReceivablesLedger } from '../../apps/web/src/lib/receivablesApi';
import { buildInvoice2030Model, formatInvoice2030Money } from '../../apps/web/src/lib/invoice2030';
import { AtlasInvoice2030 } from '../../apps/web/src/modules/finance/accounting/AtlasInvoice2030';

function fixture(): LiveReceivablesLedger {
  return {
    source: 'supabase_rls_live',
    organization: { id: 'org-2030', role: 'owner' },
    customers: [{ id: 'customer-1', org_id: 'org-2030', name: 'Customer & Sons', email: 'customer@example.test', phone: null, status: 'active' }],
    invoices: [{ id: 'inv-1', org_id: 'org-2030', customer_id: 'customer-1',
      invoice_number: 'INV-2030', issue_date: '2026-10-20', due_date: '2026-11-19',
      total: 107, balance_due: 57, status: 'open', inventory_posted_at: null,
      cogs_amount: null, gross_profit: null, gross_margin_pct: null,
      created_at: '', updated_at: '' }],
    lines: [{ id: 'line-1', org_id: 'org-2030', invoice_id: 'inv-1', product_id: null,
      description: '<script>alert(1)</script> Design service', quantity: 2, unit_price: 50, tax_rate: 7 }],
    payments: [], products: [], locations: [], loaded_at: '2026-10-20T07:00:00.000Z'
  };
}

describe('ATLAS 2030 invoice presentation, read-only accounting bridge', () => {
  it('uses canonical totals, tax, balance and customer without altering the ledger', () => {
    const ledger = fixture();
    const before = JSON.stringify(ledger);
    const model = buildInvoice2030Model(ledger, 'inv-1');
    expect(model).toMatchObject({ invoiceNumber: 'INV-2030', subtotalMinor: 10000,
      taxMinor: 700, totalMinor: 10700, paidMinor: 5000, balanceMinor: 5700,
      customerName: 'Customer & Sons' });
    expect(model.items[0].totalMinor).toBe(10700);
    expect(JSON.stringify(ledger)).toBe(before);
  });

  it('matches SQL per-line tax rounding for fractional-cent extended prices', () => {
    const ledger = fixture();
    ledger.lines[0].quantity = 1;
    ledger.lines[0].unit_price = 0.005;
    ledger.lines[0].tax_rate = 50;
    ledger.invoices[0].total = 0.01;
    ledger.invoices[0].balance_due = 0.01;
    const invoice = buildInvoice2030Model(ledger, 'inv-1');
    expect(invoice.subtotalMinor).toBe(1);
    expect(invoice.taxMinor).toBe(0);
    expect(invoice.totalMinor).toBe(1);
  });

  it('fails closed on wrong organization, mismatched customer or line scope', () => {
    const ledger = fixture();
    ledger.invoices[0].org_id = 'other';
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_invoice_scope_mismatch');
    ledger.invoices[0].org_id = 'org-2030';
    ledger.customers[0].org_id = 'other';
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_customer_scope_mismatch');
    ledger.customers[0].org_id = 'org-2030';
    ledger.lines[0].org_id = 'other';
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_line_scope_mismatch');
  });

  it('rejects invalid amounts, tax and source-of-truth discrepancies', () => {
    const ledger = fixture();
    ledger.invoices[0].total = 106.99;
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_ledger_total_mismatch');
    ledger.invoices[0].total = 107;
    ledger.lines[0].tax_rate = 101;
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_invalid_line');
    ledger.lines[0].tax_rate = 7;
    ledger.invoices[0].balance_due = 110;
    expect(() => buildInvoice2030Model(ledger, 'inv-1')).toThrow('invoice_2030_balance_exceeds_total');
  });

  it('renders semantic, escaped bilingual-ready print content with no fake verified payment link or digital signature', () => {
    const html = renderToStaticMarkup(createElement(AtlasInvoice2030, { ledger: fixture(), invoiceId: 'inv-1' }));
    expect(html).toContain('ATLAS');
    expect(html).toContain('INVOICE');
    expect(html).toContain('Print / Save preview as PDF');
    expect(html).toContain('Not digitally signed');
    expect(html).toContain('Not enabled: verified server-issued link');
    expect(html).toContain('NOT VALID FOR CUSTOMER DELIVERY');
    expect(html).toContain('$107.00');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('Pay now');
  });

  it('keeps financial formatting stable across languages', () => {
    expect(formatInvoice2030Money(10700, 'en')).toContain('107.00');
    expect(formatInvoice2030Money(10700, 'es')).toContain('107.00');
  });

  it('refuses document preview if lines are missing instead of printing a zero-value invoice', () => {
    const ledger = fixture();
    ledger.lines = [];
    const html = renderToStaticMarkup(createElement(AtlasInvoice2030, { ledger, invoiceId: 'inv-1' }));
    expect(html).toContain('Invoice preview unavailable');
    expect(html).not.toContain('Print / Save preview as PDF');
  });
});
