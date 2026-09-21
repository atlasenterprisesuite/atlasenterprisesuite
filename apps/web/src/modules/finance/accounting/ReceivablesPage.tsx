import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addInvoiceLine,
  createDraftInvoice,
  createReceivablesCustomer,
  getLiveReceivablesLedger,
  issueInvoice,
  recordReceivablesPayment,
  suggestInvoiceNumber,
  type LiveReceivablesLedger
} from '../../../lib/receivablesApi';
import { ATLAS_SESSION_EVENT } from '../../../lib/atlasSession';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const today = () => new Date().toISOString().slice(0, 10);
const defaultDueDate = () => {
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 30);
  return due.toISOString().slice(0, 10);
};

function friendlyError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : 'Unable to complete the request.';
  return raw.replaceAll('_', ' ');
}

export function ReceivablesPage() {
  const [ledger, setLedger] = useState<LiveReceivablesLedger | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => suggestInvoiceNumber());
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const [lineDescription, setLineDescription] = useState('');
  const [lineQuantity, setLineQuantity] = useState('1');
  const [lineUnitPrice, setLineUnitPrice] = useState('');
  const [lineTaxRate, setLineTaxRate] = useState('0');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await getLiveReceivablesLedger();
      setLedger(next);
      setSelectedId((current) => current && next.invoices.some((invoice) => invoice.id === current)
        ? current
        : next.invoices[0]?.id || '');
      setCustomerId((current) => current || next.customers[0]?.id || '');
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(ATLAS_SESSION_EVENT, refresh);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, refresh);
  }, []);

  const customerById = useMemo(
    () => new Map((ledger?.customers || []).map((customer) => [customer.id, customer])),
    [ledger?.customers]
  );
  const selected = ledger?.invoices.find((invoice) => invoice.id === selectedId) || null;
  const selectedLines = (ledger?.lines || []).filter((line) => line.invoice_id === selectedId);
  const selectedPayments = (ledger?.payments || []).filter((payment) => payment.invoice_id === selectedId);

  const visibleInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (ledger?.invoices || []).filter((invoice) => {
      const customer = invoice.customer_id ? customerById.get(invoice.customer_id) : null;
      const matchesQuery = !normalized
        || invoice.invoice_number.toLowerCase().includes(normalized)
        || customer?.name.toLowerCase().includes(normalized);
      return matchesQuery && (status === 'all' || invoice.status === status);
    });
  }, [ledger?.invoices, customerById, query, status]);

  const metrics = useMemo(() => {
    const invoices = ledger?.invoices || [];
    const open = invoices.filter((invoice) => !['draft', 'paid', 'cancelled'].includes(invoice.status));
    const overdue = open.filter((invoice) => invoice.due_date && invoice.due_date < today());
    return {
      customers: ledger?.customers.length || 0,
      openBalance: open.reduce((sum, invoice) => sum + invoice.balance_due, 0),
      overdueBalance: overdue.reduce((sum, invoice) => sum + invoice.balance_due, 0),
      drafts: invoices.filter((invoice) => invoice.status === 'draft').length
    };
  }, [ledger]);

  async function runMutation(action: () => Promise<unknown>, message: string) {
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setWorking(false);
    }
  }

  async function handleCustomer(event: FormEvent) {
    event.preventDefault();
    let createdId = '';
    await runMutation(async () => {
      const created = await createReceivablesCustomer({
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      });
      createdId = created.id;
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
    }, 'Customer created in the active organization.');
    if (createdId) setCustomerId(createdId);
  }

  async function handleInvoice(event: FormEvent) {
    event.preventDefault();
    let createdId = '';
    await runMutation(async () => {
      const created = await createDraftInvoice({
        customerId,
        invoiceNumber,
        issueDate,
        dueDate
      });
      createdId = created.id;
      setInvoiceNumber(suggestInvoiceNumber());
    }, 'Draft invoice created. Add at least one line before issuing it.');
    if (createdId) setSelectedId(createdId);
  }

  async function handleLine(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await runMutation(async () => {
      await addInvoiceLine({
        invoiceId: selected.id,
        description: lineDescription,
        quantity: Number(lineQuantity),
        unitPrice: Number(lineUnitPrice),
        taxRate: Number(lineTaxRate)
      });
      setLineDescription('');
      setLineQuantity('1');
      setLineUnitPrice('');
      setLineTaxRate('0');
    }, 'Invoice line saved. Total and balance were recalculated by the accounting ledger.');
  }

  async function handlePayment(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await runMutation(async () => {
      await recordReceivablesPayment({
        invoiceId: selected.id,
        amount: Number(paymentAmount),
        paidOn: paymentDate
      });
      setPaymentAmount('');
    }, 'Payment recorded and invoice balance refreshed.');
  }

  const selectedCustomer = selected?.customer_id ? customerById.get(selected.customer_id) : null;
  const canIssue = selected?.status === 'draft' && selected.total > 0;

  return (
    <section className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">ATLAS Finance · Accounting</p>
          <h1>Accounts Receivable</h1>
          <p>Live organization-scoped customer invoicing using the canonical Supabase accounting ledger.</p>
        </div>
        <div className="asof-card">
          <span>Source</span>
          <strong>{ledger ? 'Supabase RLS · live' : 'Loading'}</strong>
        </div>
      </header>

      <div className="notice strong">
        Invoice records are real. External email delivery and payment-processor collection remain disabled until the organization authorizes and verifies those providers.
      </div>

      <div className="metric-grid">
        <article><span>Customers</span><strong>{metrics.customers}</strong><small>active organization</small></article>
        <article><span>Open receivables</span><strong>{currency.format(metrics.openBalance)}</strong><small>issued, unpaid balance</small></article>
        <article><span>Overdue</span><strong>{currency.format(metrics.overdueBalance)}</strong><small>past due date</small></article>
        <article><span>Draft invoices</span><strong>{metrics.drafts}</strong><small>not yet issued</small></article>
      </div>

      <div className="module-grid">
        <form className="workspace-card" onSubmit={handleCustomer}>
          <div className="toolbar">
            <label className="field"><span>Customer name</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
            <label className="field"><span>Email</span><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></label>
            <label className="field"><span>Phone</span><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
            <button className="primary-action" type="submit" disabled={working}>Create customer</button>
          </div>
        </form>

        <form className="workspace-card" onSubmit={handleInvoice}>
          <div className="toolbar">
            <label className="field"><span>Customer</span><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required><option value="">Select customer</option>{ledger?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label className="field"><span>Invoice number</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required /></label>
            <label className="field"><span>Issue date</span><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required /></label>
            <label className="field"><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <button className="primary-action" type="submit" disabled={working || !customerId}>Create draft invoice</button>
          </div>
        </form>
      </div>

      {error && <div className="notice strong" role="alert">{error}</div>}
      {success && <div className="notice" role="status">{success}</div>}

      <section className="workspace-card">
        <div className="toolbar">
          <label className="field wide-field"><span>Search</span><input placeholder="Invoice number or customer" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All</option><option value="draft">Draft</option><option value="open">Open</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></label>
          <button className="secondary-action" type="button" onClick={() => void load()} disabled={loading || working}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Issue</th><th>Due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {visibleInvoices.map((invoice) => (
                <tr key={invoice.id} className={selectedId === invoice.id ? 'selected-row' : ''} onClick={() => setSelectedId(invoice.id)}>
                  <td><button className="link-button" type="button" onClick={() => setSelectedId(invoice.id)}>{invoice.invoice_number}</button></td>
                  <td>{invoice.customer_id ? customerById.get(invoice.customer_id)?.name || 'Unknown customer' : 'No customer'}</td>
                  <td>{invoice.issue_date}</td>
                  <td>{invoice.due_date || '—'}</td>
                  <td className="money">{currency.format(invoice.total)}</td>
                  <td className="money">{currency.format(invoice.balance_due)}</td>
                  <td><span className={`status-pill ${invoice.status}`}>{invoice.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && visibleInvoices.length === 0 && <div className="empty-state"><strong>No invoices yet</strong><span>Create a customer and draft invoice above. No demo receivables are seeded.</span></div>}
          {loading && <div className="empty-state"><strong>Loading live receivables…</strong><span>Reading only the active organization through RLS.</span></div>}
        </div>
      </section>

      {selected && (
        <section className="detail-panel">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">Invoice detail</p>
              <h2>{selected.invoice_number}</h2>
              <span>{selectedCustomer?.name || 'No customer'} · {selected.status}</span>
            </div>
            <div className="detail-balance"><span>Balance due</span><strong>{currency.format(selected.balance_due)}</strong></div>
          </div>

          {selected.status === 'draft' && (
            <form className="toolbar" onSubmit={handleLine}>
              <label className="field wide-field"><span>Description</span><input value={lineDescription} onChange={(event) => setLineDescription(event.target.value)} required /></label>
              <label className="field"><span>Quantity</span><input type="number" min="0.01" step="0.01" value={lineQuantity} onChange={(event) => setLineQuantity(event.target.value)} required /></label>
              <label className="field"><span>Unit price</span><input type="number" min="0" step="0.01" value={lineUnitPrice} onChange={(event) => setLineUnitPrice(event.target.value)} required /></label>
              <label className="field"><span>Tax %</span><input type="number" min="0" step="0.01" value={lineTaxRate} onChange={(event) => setLineTaxRate(event.target.value)} required /></label>
              <button className="primary-action" type="submit" disabled={working}>Add line</button>
            </form>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Tax</th><th>Line total</th></tr></thead>
              <tbody>
                {selectedLines.map((line) => {
                  const lineTotal = line.quantity * line.unit_price * (1 + line.tax_rate / 100);
                  return <tr key={line.id}><td>{line.description}</td><td>{line.quantity}</td><td className="money">{currency.format(line.unit_price)}</td><td>{line.tax_rate}%</td><td className="money">{currency.format(lineTotal)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="payment-history">
            <div>
              <h3>Governed actions</h3>
              <p>Issuing is an explicit financial action. Delivery remains separate and provider-gated.</p>
            </div>
            {selected.status === 'draft' && (
              <article>
                <span>Issue invoice</span>
                <strong>{currency.format(selected.total)}</strong>
                <button className="primary-action" type="button" disabled={!canIssue || working} onClick={() => void runMutation(() => issueInvoice(selected.id), 'Invoice issued and moved to open receivables.')}>Issue now</button>
              </article>
            )}
            <article>
              <span>Print / save PDF</span>
              <strong>{selected.invoice_number}</strong>
              <button className="secondary-action" type="button" onClick={() => window.print()}>Print invoice view</button>
            </article>
          </div>

          {selected.status !== 'draft' && selected.status !== 'cancelled' && selected.balance_due > 0 && (
            <form className="toolbar" onSubmit={handlePayment}>
              <label className="field"><span>Payment amount</span><input type="number" min="0.01" max={selected.balance_due} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label>
              <label className="field"><span>Payment date</span><input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required /></label>
              <button className="primary-action" type="submit" disabled={working}>Record payment</button>
            </form>
          )}

          <div className="payment-history">
            <div><h3>Payment history</h3><p>Confirmed payments update the canonical invoice balance.</p></div>
            {selectedPayments.map((payment) => <article key={payment.id}><span>{payment.payment_date}</span><strong>{currency.format(payment.amount)}</strong><small>{payment.status}</small></article>)}
            {selectedPayments.length === 0 && <article><span>No payments recorded</span><small>Balance remains {currency.format(selected.balance_due)}</small></article>}
          </div>
        </section>
      )}
    </section>
  );
}
