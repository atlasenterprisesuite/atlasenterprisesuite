import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MidnightInvoiceDocument } from '../../apps/web/src/modules/finance/accounting/MidnightInvoiceDocument';
import type { MidnightInvoice } from '../../apps/web/src/modules/finance/accounting/midnightInvoice';

const model: MidnightInvoice = {
  invoiceNumber: 'INV-001',
  documentTitle: 'INVOICE / FACTURA',
  customerName: 'Customer & Company',
  issueDate: '2026-10-20',
  dueDate: '2026-11-20',
  status: 'open',
  currency: 'USD',
  totalCents: 10700,
  balanceCents: 10700,
  lines: [{
    id: 'line-1',
    description: '<script>alert(1)</script> consulting',
    quantity: 1,
    unitPrice: 100,
    taxRate: 7,
    lineTotalCents: 10700
  }],
  warning: null,
  paymentEnabled: false,
  signed: false
};

describe('Midnight invoice accessible print markup', () => {
  it('renders EN/ES labels, authoritative values and no invented payment or signature controls', () => {
    const html = renderToStaticMarkup(createElement(MidnightInvoiceDocument, { model }));
    expect(html).toContain('INVOICE / FACTURA');
    expect(html).toContain('Bill to / Facturar a');
    expect(html).toContain('Balance due / Saldo pendiente');
    expect(html).toContain('$107.00');
    expect(html).toContain('Unsigned / Sin firma digital');
    expect(html).toContain('Sin enlace de pago');
    expect(html).not.toContain('Pay now');
  });

  it('escapes stored customer and item text rather than injecting HTML', () => {
    const html = renderToStaticMarkup(createElement(MidnightInvoiceDocument, { model }));
    expect(html).toContain('Customer &amp; Company');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
