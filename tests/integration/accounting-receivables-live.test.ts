import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addInvoiceLine,
  createDraftInvoice,
  createReceivablesCustomer,
  getLiveReceivablesLedger,
  issueInvoice,
  recordReceivablesPayment
} from '../../apps/web/src/lib/receivablesApi';
import { clearAtlasSession } from '../../apps/web/src/lib/atlasSession';

afterEach(() => {
  clearAtlasSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function orgResponse() {
  return new Response(JSON.stringify([{ org_id: 'org-1', role: 'owner', status: 'active' }]), { status: 200 });
}

describe('ATLAS Accounts Receivable live bridge', () => {
  it('loads customers, invoices, lines and payments inside the active organization', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(orgResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'customer-1', org_id: 'org-1', name: 'Client One', email: null, phone: null, status: 'active' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'invoice-1', org_id: 'org-1', customer_id: 'customer-1', invoice_number: 'INV-1', issue_date: '2026-09-20', due_date: '2026-10-20', total: '125.00', balance_due: '125.00', status: 'open', created_at: '', updated_at: '' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'line-1', org_id: 'org-1', invoice_id: 'invoice-1', product_id: null, description: 'ATLAS service', quantity: '1', unit_price: '125', tax_rate: '0' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const ledger = await getLiveReceivablesLedger();

    expect(ledger.source).toBe('supabase_rls_live');
    expect(ledger.organization).toEqual({ id: 'org-1', role: 'owner' });
    expect(ledger.invoices[0]).toMatchObject({ invoice_number: 'INV-1', total: 125, balance_due: 125 });
    expect(ledger.lines[0]).toMatchObject({ description: 'ATLAS service', quantity: 1, unit_price: 125 });
    for (const call of fetchMock.mock.calls.slice(1)) {
      expect((call[1]?.headers as Record<string, string>).authorization).toBe('Bearer live-token');
      expect(String(call[0])).toContain('org_id=eq.org-1');
    }
  });

  it('creates customer, draft invoice and invoice line through RLS-scoped tables', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(orgResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'customer-1', org_id: 'org-1', name: 'Client One', email: null, phone: null, status: 'active' }]), { status: 201 }))
      .mockResolvedValueOnce(orgResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'invoice-1', org_id: 'org-1', customer_id: 'customer-1', invoice_number: 'INV-1', issue_date: '2026-09-20', due_date: '2026-10-20', total: 0, balance_due: 0, status: 'draft', created_at: '', updated_at: '' }]), { status: 201 }))
      .mockResolvedValueOnce(orgResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'line-1', org_id: 'org-1', invoice_id: 'invoice-1', product_id: null, description: 'ATLAS service', quantity: 1, unit_price: 125, tax_rate: 0 }]), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await createReceivablesCustomer({ name: 'Client One' });
    await createDraftInvoice({ customerId: 'customer-1', invoiceNumber: 'INV-1', issueDate: '2026-09-20', dueDate: '2026-10-20' });
    await addInvoiceLine({ invoiceId: 'invoice-1', description: 'ATLAS service', quantity: 1, unitPrice: 125, taxRate: 0 });

    const customerBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const invoiceBody = JSON.parse(String(fetchMock.mock.calls[3][1]?.body));
    const lineBody = JSON.parse(String(fetchMock.mock.calls[5][1]?.body));
    expect(customerBody).toMatchObject({ org_id: 'org-1', name: 'Client One' });
    expect(invoiceBody).toMatchObject({ org_id: 'org-1', customer_id: 'customer-1', status: 'draft' });
    expect(lineBody).toMatchObject({ org_id: 'org-1', invoice_id: 'invoice-1', unit_price: 125 });
  });

  it('issues only a positive-total draft and records payments through the canonical RPC', async () => {
    localStorage.setItem('atlas_access_token', 'live-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(orgResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'invoice-1', org_id: 'org-1', customer_id: 'customer-1', invoice_number: 'INV-1', issue_date: '2026-09-20', due_date: '2026-10-20', total: 125, balance_due: 125, status: 'open', created_at: '', updated_at: '' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify('payment-1'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await issueInvoice('invoice-1');
    await recordReceivablesPayment({ invoiceId: 'invoice-1', amount: 25, paidOn: '2026-09-20' });

    expect(String(fetchMock.mock.calls[1][0])).toContain('status=eq.draft&total=gt.0');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PATCH');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/rest/v1/rpc/record_invoice_payment');
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      invoice_uuid: 'invoice-1',
      payment_amount: 25,
      paid_on: '2026-09-20'
    });
  });
});
