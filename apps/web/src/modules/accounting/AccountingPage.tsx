import { Link } from 'react-router-dom';
import { AccountingEmptyState } from './AccountingEmptyState';
import { useAccountingData } from './AccountingDataProvider';

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function AccountingPage() {
  const state = useAccountingData();

  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance / Accounting</p>
      <h1>Accounting</h1>
      <p className="atlas-page__lede">
        Organization-scoped accounting records are loaded from the configured ATLAS data source and remain subject to database authorization policies.
      </p>

      <nav className="atlas-submodule-nav" aria-label="Accounting workflows">
        <Link to="/finance/accounting/general-ledger">General Ledger</Link>
        <Link to="/finance/accounting/chart-of-accounts">Chart of Accounts</Link>
        <Link to="/finance/accounting/journal-entries">Journal Entries</Link>
        <Link to="/finance/accounting/accounts-receivable">Accounts Receivable</Link>
        <Link to="/finance/accounting/accounts-payable">Accounts Payable</Link>
        <Link to="/finance/accounting/bank-cash">Bank &amp; Cash</Link>
        <Link to="/finance/accounting/reconciliation">Reconciliation</Link>
      </nav>

      {(state.status === 'waiting' || state.status === 'loading') && (
        <section className="atlas-status-panel" role="status">
          <strong>Loading accounting records</strong>
          <span>Resolving the authorized organization data set.</span>
        </section>
      )}

      {state.status === 'connection_unavailable' && (
        <section className="atlas-status-panel" role="status">
          <strong>Accounting connection unavailable</strong>
          <span>No configured real Accounting repository is available for this runtime.</span>
        </section>
      )}

      {state.status === 'error' && (
        <section className="atlas-status-panel atlas-status-panel--degraded" role="status">
          <strong>Accounting data unavailable</strong>
          <span>The authorized Accounting query did not complete successfully.</span>
        </section>
      )}

      {state.status === 'ready' && (() => {
        const { accounts, journals, customers, vendors, invoices, payments, bills } = state.data;
        const totalRecords = accounts.length + journals.length + customers.length + vendors.length + invoices.length + payments.length + bills.length;
        if (totalRecords === 0) return <AccountingEmptyState />;
        return (
          <section className="atlas-card-grid" aria-label="Accounting record counts">
            <div className="atlas-module-card"><strong>{countLabel(accounts.length, 'Account', 'Accounts')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(journals.length, 'Journal', 'Journals')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(customers.length, 'Customer', 'Customers')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(vendors.length, 'Vendor', 'Vendors')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(invoices.length, 'Invoice', 'Invoices')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(payments.length, 'Payment', 'Payments')}</strong></div>
            <div className="atlas-module-card"><strong>{countLabel(bills.length, 'Bill', 'Bills')}</strong></div>
          </section>
        );
      })()}
    </main>
  );
}
