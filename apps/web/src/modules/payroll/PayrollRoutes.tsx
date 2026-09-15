import { Link, Route, Routes } from 'react-router-dom';
import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import './payroll.css';

const payrollTiles = [
  { to: '/payroll/overview', eyebrow: 'Control', title: 'Payroll Overview', description: 'Payroll status and configuration.' },
  { to: '/payroll/people', eyebrow: 'Workforce', title: 'People', description: 'Payroll-ready worker records.' },
  { to: '/payroll/time-earnings', eyebrow: 'Inputs', title: 'Time & Earnings', description: 'Hours, earnings and adjustments.' },
  { to: '/payroll/pay-runs', eyebrow: 'Execution', title: 'Pay Runs', description: 'Prepare and review payroll cycles.' }
] as const;

const payrollSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Payroll architecture',
    title: 'People, inputs and pay-run execution',
    description: 'Payroll workspaces remain organization-scoped and expose only implemented routes while production records stay gated behind authorized data configuration.',
    cards: payrollTiles.map((tile) => ({
      label: tile.eyebrow,
      title: tile.title,
      description: tile.description,
      to: tile.to
    }))
  },
  {
    eyebrow: 'Governance',
    title: 'Controlled payroll before money movement',
    description: 'ATLAS keeps payroll readiness, source state and approvals explicit before any operational value can be treated as production data.',
    cards: [
      { label: 'Tenant', title: 'Organization scoped', description: 'People, time and payroll execution remain inside the authenticated ATLAS organization.' },
      { label: 'Inputs', title: 'Source-backed earnings', description: 'Hours, earnings and adjustments must originate from authorized tenant data sources.' },
      { label: 'Execution', title: 'Governed pay runs', description: 'Preparation and review stay separated from irreversible money movement and external filing dependencies.' }
    ]
  }
];

function PayrollHome() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Enterprise Suite"
      title="ATLAS PAYROLL"
      description="Payroll intelligence, governed inputs and controlled execution."
      narrative="People • Pay • Progress"
      sections={payrollSections}
      statusNote="Production payroll metrics stay hidden until governed people, time, earnings and payroll data sources are configured for the active organization."
    >
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
    </ModuleExperiencePage>
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
