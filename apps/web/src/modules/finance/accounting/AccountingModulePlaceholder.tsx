import { Link } from 'react-router-dom';

export function AccountingModulePlaceholder() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Finance</p>
        <h1>Accounting</h1>
        <p>Accounts Payable is the verified accounting slice available in the current repository milestone.</p>
      </header>
      <Link className="module-card enabled single-card" to="/finance/accounting/accounts-payable">
        <span>Operations</span>
        <strong>Open Accounts Payable</strong>
        <p>Enter vendor bills, aging, approvals, balances, and payment application history.</p>
      </Link>
    </section>
  );
}
