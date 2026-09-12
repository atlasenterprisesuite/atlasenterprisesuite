import { Link, Route, Routes } from 'react-router-dom';
import './payroll.css';

const payrollTiles = [
  { to: '/payroll/overview', eyebrow: 'Control', title: 'Payroll Overview', description: 'Payroll status and configuration.' },
  { to: '/payroll/people', eyebrow: 'Workforce', title: 'People', description: 'Payroll-ready worker records.' },
  { to: '/payroll/time-earnings', eyebrow: 'Inputs', title: 'Time & Earnings', description: 'Hours, earnings and adjustments.' },
  { to: '/payroll/pay-runs', eyebrow: 'Execution', title: 'Pay Runs', description: 'Prepare and review payroll cycles.' }
] as const;

function PayrollHome() {
  return (
    <section className="payroll-page" aria-labelledby="payroll-title">
      <div className="payroll-ambient" aria-hidden="true" />

      <header className="payroll-hero">
        <div>
          <p className="payroll-kicker">ATLAS Enterprise Suite</p>
          <h1 id="payroll-title">ATLAS PAYROLL</h1>
          <p className="payroll-tagline">People • Pay • Progress</p>
        </div>
        <div className="payroll-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </header>

      <nav className="payroll-tile-grid" aria-label="Payroll workspaces">
        {payrollTiles.map((tile) => (
          <Link key={tile.to} className="payroll-tile" to={tile.to}>
            <span>{tile.eyebrow}</span>
            <strong>{tile.title}</strong>
            <p>{tile.description}</p>
            <small>Open</small>
          </Link>
        ))}
      </nav>

      <section className="payroll-console" aria-label="Payroll operations console">
        <div className="payroll-laptop-frame">
          <div className="payroll-laptop-bar" aria-hidden="true"><span /><span /><span /></div>
          <div className="payroll-console-body">
            <div className="payroll-console-heading">
              <div>
                <p>Payroll operations</p>
                <h2>Ready for configuration</h2>
              </div>
              <span className="payroll-status">Not configured</span>
            </div>
            <div className="payroll-empty-state">
              <div className="payroll-empty-globe" aria-hidden="true" />
              <div>
                <strong>Payroll data is not configured</strong>
                <p>Connect governed people, time, earnings and payroll data sources before operational metrics are shown.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="payroll-laptop-base" aria-hidden="true" />
      </section>
    </section>
  );
}

function PayrollSection({ title, description }: { title: string; description: string }) {
  return (
    <section className="payroll-page payroll-section-page">
      <header className="payroll-section-header">
        <p className="payroll-kicker">ATLAS PAYROLL</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="payroll-section-empty">
        <strong>Configuration required</strong>
        <p>No production payroll records are shown until an authorized tenant data source is connected.</p>
      </div>
      <Link className="payroll-back-link" to="/payroll">Back to Payroll</Link>
    </section>
  );
}

export function PayrollRoutes() {
  return (
    <Routes>
      <Route index element={<PayrollHome />} />
      <Route path="overview" element={<PayrollSection title="Payroll Overview" description="Governed payroll status and configuration." />} />
      <Route path="people" element={<PayrollSection title="People" description="Payroll-scoped worker records and eligibility." />} />
      <Route path="time-earnings" element={<PayrollSection title="Time & Earnings" description="Governed time, earnings and adjustment inputs." />} />
      <Route path="pay-runs" element={<PayrollSection title="Pay Runs" description="Prepare, review and approve payroll cycles." />} />
    </Routes>
  );
}
