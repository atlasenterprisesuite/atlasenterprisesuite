import { useState } from 'react';
import { calculateAging } from '../../../../../packages/accounting/src';
import { useAtlasContext } from '../../app/AtlasContext';
import { useAccountingData, useAccountingRefresh } from './AccountingDataProvider';
import { useArApWriteService } from './ArApWriteProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function ReceivablesPage() {
  const identity = useAtlasContext();
  const state = useAccountingData();
  const refresh = useAccountingRefresh();
  const writeService = useArApWriteService();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayDateOnly());
  const [writeState, setWriteState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [writeError, setWriteError] = useState('');

  const canWrite = identity.status === 'ready'
    && identity.permissions.includes('accounting.write')
    && writeService !== null;

  const submitPayment = async () => {
    if (identity.status !== 'ready' || !writeService || !selectedInvoiceId) return;

    setWriteState('saving');
    setWriteError('');
    try {
      await writeService.recordInvoicePayment({
        organizationId: identity.organizationId,
        invoiceId: selectedInvoiceId,
        amount: Number(paymentAmount),
        paidOn: paymentDate,
      });
      setWriteState('success');
      setSelectedInvoiceId(null);
      setPaymentAmount('');
      refresh();
    } catch (error) {
      setWriteState('error');
      setWriteError(error instanceof Error ? error.message : 'Invoice payment failed');
    }
  };

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Accounts Receivable</h1>
      <p className="atlas-page__lede">
        Customer invoices and payments are read from the authorized organization accounting records.
      </p>

      {writeState === 'success' && (
        <section className="atlas-status-panel" role="status">
          <strong>Payment recorded</strong>
          <span>Receivables are being refreshed from the accounting repository.</span>
        </section>
      )}

      {writeState === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="alert">
          <strong>Payment not recorded</strong>
          <span>{writeError}</span>
        </section>
      )}

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading receivables</strong>
          <span>Reading authorized customer, invoice, and payment records.</span>
        </section>
      )}

      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Accounts Receivable connection unavailable</strong>
          <span>No configured real Accounting repository is available.</span>
        </section>
      )}

      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Accounts Receivable unavailable</strong>
          <span>The authorized receivables query did not complete successfully.</span>
        </section>
      )}

      {state.status === 'ready' && (() => {
        const { customers, invoices, payments } = state.data;
        const openInvoices = invoices.filter((invoice) => Number(invoice.balanceDue ?? 0) > 0);
        const aging = calculateAging(openInvoices, todayDateOnly());
        const customersById = new Map(customers.map((customer) => [customer.id, customer]));
        const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

        return (
          <>
            <section className="atlas-card-grid" aria-label="Accounts Receivable counts">
              <div className="atlas-module-card"><strong>{customers.length} customers</strong></div>
              <div className="atlas-module-card"><strong>{invoices.length} invoices</strong></div>
              <div className="atlas-module-card"><strong>{payments.length} payments</strong></div>
              <div className="atlas-module-card"><strong>{currency.format(aging.total)} open balance</strong></div>
            </section>

            {customers.length === 0 && invoices.length === 0 && payments.length === 0 ? (
              <section className="atlas-status-panel" aria-label="Accounts Receivable empty state">
                <strong>No receivables recorded</strong>
                <span>This organization currently has no customer, invoice, or payment records.</span>
              </section>
            ) : (
              <>
                <section className="atlas-status-panel" aria-label="Accounts Receivable aging">
                  <strong>Receivables aging</strong>
                  <span>Current: {currency.format(aging.current)}</span>
                  <span>1–30 days: {currency.format(aging.days1to30)}</span>
                  <span>31–60 days: {currency.format(aging.days31to60)}</span>
                  <span>61–90 days: {currency.format(aging.days61to90)}</span>
                  <span>Over 90 days: {currency.format(aging.over90)}</span>
                </section>

                {invoices.length > 0 && (
                  <section className="atlas-status-panel" aria-label="Accounts Receivable invoices">
                    <strong>{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</strong>
                    <div className="atlas-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice</th>
                            <th>Customer</th>
                            <th>Issue date</th>
                            <th>Due date</th>
                            <th>Total</th>
                            <th>Balance</th>
                            <th>Status</th>
                            {canWrite && <th>Action</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td>{invoice.invoiceNumber}</td>
                              <td>{invoice.customerId ? customersById.get(invoice.customerId)?.name ?? 'Customer not found' : 'Customer not linked'}</td>
                              <td>{invoice.issueDate ?? 'Issue date not provided'}</td>
                              <td>{invoice.dueDate ?? 'Due date not provided'}</td>
                              <td>{currency.format(Number(invoice.total ?? 0))}</td>
                              <td>{currency.format(Number(invoice.balanceDue ?? 0))}</td>
                              <td>{invoice.status ?? 'Status not provided'}</td>
                              {canWrite && (
                                <td>
                                  {Number(invoice.balanceDue ?? 0) > 0 && (
                                    <button
                                      type="button"
                                      disabled={writeState === 'saving'}
                                      onClick={() => {
                                        setSelectedInvoiceId(invoice.id);
                                        setPaymentAmount('');
                                        setPaymentDate(todayDateOnly());
                                        setWriteState('idle');
                                      }}
                                      aria-label={`Record payment ${invoice.invoiceNumber}`}
                                    >
                                      Record payment
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {canWrite && selectedInvoice && (
                  <section className="atlas-status-panel" aria-label="Record invoice payment">
                    <strong>Record payment for {selectedInvoice.invoiceNumber}</strong>
                    <label className="atlas-form-field">
                      Payment amount
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={Number(selectedInvoice.balanceDue ?? 0)}
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                    </label>
                    <label className="atlas-form-field">
                      Payment date
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                      />
                    </label>
                    <div className="atlas-action-row">
                      <button type="button" disabled={writeState === 'saving'} onClick={() => void submitPayment()}>
                        Submit payment
                      </button>
                      <button type="button" disabled={writeState === 'saving'} onClick={() => setSelectedInvoiceId(null)}>
                        Cancel
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        );
      })()}
    </main>
  );
}
