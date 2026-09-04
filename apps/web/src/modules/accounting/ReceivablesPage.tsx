import { calculateAging } from '../../../../../packages/accounting/src';
import { useAccountingData } from './AccountingDataProvider';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

export function ReceivablesPage() {
  const state = useAccountingData();

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Accounts Receivable</h1>
      <p className="atlas-page__lede">
        Customer invoices and payments are read from the authorized organization accounting records.
      </p>

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
              <section className="atlas-status-panel" aria-label="Accounts Receivable aging">
                <strong>Receivables aging</strong>
                <span>Current: {currency.format(aging.current)}</span>
                <span>1–30 days: {currency.format(aging.days1to30)}</span>
                <span>31–60 days: {currency.format(aging.days31to60)}</span>
                <span>61–90 days: {currency.format(aging.days61to90)}</span>
                <span>Over 90 days: {currency.format(aging.over90)}</span>
              </section>
            )}
          </>
        );
      })()}
    </main>
  );
}
