import { Link } from 'react-router-dom';

export function FinanceHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Finance</p>
        <h1>Finance</h1>
        <p>Governed finance operations with Accounting as the active enterprise domain.</p>
      </header>
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance/accounting">
          <span>Finance</span>
          <strong>Accounting</strong>
          <p>Open the accounting workspace and its verified Accounts Payable slice.</p>
        </Link>
      </div>
    </section>
  );
}
