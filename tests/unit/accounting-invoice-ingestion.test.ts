import { describe, expect, it } from 'vitest';
import { buildInvoiceDraftJournal, normalizeInvoiceIngestion } from '../../packages/accounting/src';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };

describe('accounting invoice ingestion', () => {
  it('normalizes a verified sales invoice and creates a balanced draft journal', () => {
    const invoice = normalizeInvoiceIngestion({
      ...scope,
      source: 'verified-extraction',
      invoiceNumber: 'INV-1001',
      issueDate: '2026-09-26',
      dueDate: '2026-10-26',
      counterpartyName: 'Atlas Customer LLC',
      currency: 'USD',
      kind: 'sale',
      lines: [{ description: 'Professional services', quantity: 2, unitPrice: 500, taxRate: 0.065 }]
    });

    expect(invoice.subtotal).toBe(1000);
    expect(invoice.tax).toBe(65);
    expect(invoice.total).toBe(1065);

    const journal = buildInvoiceDraftJournal(invoice);
    expect(journal.lines).toEqual([
      expect.objectContaining({ accountCode: '1100', debit: 1065, credit: 0 }),
      expect.objectContaining({ accountCode: '4000', debit: 0, credit: 1000 }),
      expect.objectContaining({ accountCode: '2100', debit: 0, credit: 65 })
    ]);
  });

  it('requires explicit purchase account codes instead of guessing classifications', () => {
    const invoice = normalizeInvoiceIngestion({
      ...scope,
      source: 'manual',
      invoiceNumber: 'BILL-2001',
      issueDate: '2026-09-26',
      counterpartyName: 'Office Vendor LLC',
      currency: 'USD',
      kind: 'purchase',
      lines: [{ description: 'Supplies', quantity: 1, unitPrice: 200 }]
    });

    expect(() => buildInvoiceDraftJournal(invoice)).toThrow('purchase_account_code_required');
  });

  it('fails closed on invalid extraction values', () => {
    expect(() => normalizeInvoiceIngestion({
      ...scope,
      source: 'verified-extraction',
      invoiceNumber: '',
      issueDate: '09/26/2026',
      counterpartyName: '',
      currency: 'USD',
      kind: 'sale',
      lines: []
    })).toThrow();
  });
});
