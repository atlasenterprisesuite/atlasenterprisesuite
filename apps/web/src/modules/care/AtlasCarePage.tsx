import { Link } from 'react-router-dom';

const workflow = [
  ['Family / Person', 'Create the governed care context without treating eligibility or coverage as verified.'],
  ['Eligibility', 'Route eligibility and benefit evidence to governed verification surfaces.'],
  ['Authorized caregiver', 'Bind workforce identity, role and authorization before care activity.'],
  ['Training & certifications', 'Use ATLAS Learning and People evidence for required readiness.'],
  ['Care plan', 'Coordinate approved tasks and wellbeing context without replacing clinical care.'],
  ['Hours & timecards', 'Capture organization-scoped time evidence for payroll and audit.'],
  ['Validation', 'Apply policy, authorization and exception checks before downstream payment.'],
  ['Payroll / Payments', 'Route approved compensation through governed Payroll and Finance boundaries.'],
  ['Audit', 'Preserve traceable evidence across the complete care workflow.']
] as const;

const dependencies = [
  ['ATLAS Health', '/health'],
  ['ATLAS People', '/people'],
  ['ATLAS Learning', '/learning'],
  ['ATLAS Payroll', '/payroll'],
  ['Finance', '/finance'],
  ['ATLAS Insurance', '/insurance'],
  ['ATLAS Cloud', '/cloud']
] as const;

export function AtlasCarePage() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Care · Integration foundation</p>
        <h1>Care coordination with governed workforce, time, payroll and evidence boundaries</h1>
        <p>
          ATLAS Care connects family and person context to eligibility, authorized caregivers,
          training, care plans, time evidence, payroll and audit. This entry surface does not claim
          live payer, EVV, clinical or provider connectivity without verified evidence.
        </p>
      </header>

      <div className="notice strong">
        BETA · Canonical ATLAS entry point is active. External care-provider, payer and regulated
        workflow connections remain evidence-gated.
      </div>

      <section className="detail-panel" aria-label="ATLAS Care workflow">
        <div className="detail-heading">
          <div><p className="eyebrow">End-to-end workflow</p><h2>Care operating chain</h2></div>
        </div>
        <div className="module-grid">
          {workflow.map(([title, description], index) => (
            <article className="module-card" key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="detail-panel" aria-label="ATLAS Care dependencies">
        <div className="detail-heading">
          <div><p className="eyebrow">Native dependencies</p><h2>Connected ATLAS surfaces</h2></div>
        </div>
        <div className="module-grid">
          {dependencies.map(([name, to]) => (
            <Link className="module-card enabled" key={name} to={to}>
              <span>Dependency</span>
              <strong>{name}</strong>
              <p>Open the canonical ATLAS surface. Runtime readiness remains governed by that module.</p>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
