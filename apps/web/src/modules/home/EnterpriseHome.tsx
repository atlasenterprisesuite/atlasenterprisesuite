import { Link } from 'react-router-dom';

export function EnterpriseHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Enterprise Suite</p>
        <h1>ATLAS Enterprise Suite</h1>
        <p>One governed enterprise ecosystem where modules share tenant context, permissions, audit contracts, and a single application shell.</p>
      </header>
      <div className="module-grid">
        <Link className="module-card enabled" to="/finance">
          <span>Business</span>
          <strong>Finance</strong>
          <p>Accounting and financial operations.</p>
        </Link>
        <Link className="module-card enabled" to="/health">
          <span>Health</span>
          <strong>ATLAS Health</strong>
          <p>Smart Health proposal, operations, and governed research enter through the shared ATLAS shell.</p>
        </Link>
      </div>
    </section>
  );
}
