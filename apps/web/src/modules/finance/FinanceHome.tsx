import { Link } from 'react-router-dom';

export function FinanceHome() {
  return (
    <main className="atlas-page atlas-module-page">
      <p className="atlas-eyebrow">ATLAS Finance</p>
      <h1>Finance</h1>
      <p className="atlas-page__lede">
        Governed financial operations live behind the shared ATLAS tenant, organization, permission, and audit boundary.
      </p>
      <div className="atlas-card-grid">
        <Link className="atlas-module-card" to="/finance/accounting">
          <strong>Accounting</strong>
          <span>Enter the accounting domain boundary.</span>
        </Link>
      </div>
    </main>
  );
}
