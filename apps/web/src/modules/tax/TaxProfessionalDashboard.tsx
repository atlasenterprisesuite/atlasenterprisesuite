import { Link } from 'react-router-dom';

type WorkflowStep = {
  number: number;
  label: string;
  route: string;
  glyph: string;
};

const workflow: WorkflowStep[] = [
  { number: 1, label: 'Client / Engagement', route: '/tax/control', glyph: '◉' },
  { number: 2, label: 'Return', route: '/tax/control', glyph: '▤' },
  { number: 3, label: 'Documents / Books', route: '/tax/documents/depth', glyph: '▱' },
  { number: 4, label: 'Tax Fact Ledger', route: '/tax/prepare', glyph: '◎' },
  { number: 5, label: 'Workpapers', route: '/tax/prepare', glyph: '▧' },
  { number: 6, label: 'Forms / Lines', route: '/tax/forms', glyph: '▦' },
  { number: 7, label: 'Diagnostics', route: '/tax/review', glyph: '◇' },
  { number: 8, label: 'Review', route: '/tax/review', glyph: '⌕' },
  { number: 9, label: 'Signature', route: '/tax/prepare', glyph: '✎' },
  { number: 10, label: 'Immutable Submission Snapshot', route: '/tax/prepare', glyph: '⬡' },
  { number: 11, label: 'Carryforwards / Audit', route: '/tax/prepare', glyph: '▥' }
];

const productiveCore = [
  'Persistent returns',
  'Source documents',
  'Versioned tax facts',
  'Line mappings',
  'Workpapers',
  'Diagnostics',
  'Carryforwards',
  'Snapshots',
  'Audit trail'
];

const sourceEngines = [
  ['1098', 'Mortgage interest statements'],
  ['1095-A', 'Health insurance marketplace'],
  ['SSA-1099', 'Social Security benefits'],
  ['1099-B / Brokerage', 'Investment transactions']
] as const;

const individualCore = [
  'Form 1040 line 1–15',
  'Standard deduction',
  'Schedule A',
  'SALT phase-down',
  'Reviewed itemized deductions'
];

const nextEngines = [
  'Social Security line 6b',
  'Schedule D',
  'Line 16 tax method',
  'QBI',
  'Schedule 1-A'
];

export function TaxProfessionalDashboard() {
  return (
    <div className="tax-dashboard">
      <section className="tax-dashboard-hero">
        <div>
          <p className="tax-dashboard-kicker">ATLAS Tax</p>
          <h1>Professional Workspace</h1>
          <p>A complete, integrated tax-preparation platform for preparers and firms.</p>
        </div>

        <div className="tax-dashboard-hero-actions">
          <Link className="tax-year-card" to="/tax/control">
            <span className="tax-year-icon">▣</span>
            <span>
              <strong>2025 Tax Year</strong>
              <small>Individual · Productive core</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </Link>
          <div className="tax-dashboard-motto">
            <span>MORE THAN SOFTWARE.</span>
            <strong>A STRONGER TOMORROW.</strong>
          </div>
        </div>
      </section>

      <section className="tax-dashboard-workflow">
        <div className="tax-dashboard-section-head">
          <div>
            <h2>Return Workflow</h2>
            <p>From client intake to a defensible, immutable record.</p>
          </div>
          <div className="tax-dashboard-control-state">
            <span className="tax-state-dot" aria-hidden="true" />
            <span>Authenticated workspace</span>
            <span className="tax-state-separator" aria-hidden="true" />
            <span>Tax Year 2025</span>
          </div>
        </div>

        <div className="tax-workflow-track">
          {workflow.map((step, index) => (
            <div className="tax-workflow-node-wrap" key={step.number}>
              <Link className="tax-workflow-node" to={step.route}>
                <span className="tax-workflow-icon" aria-hidden="true">{step.glyph}</span>
                <strong>{step.label}</strong>
                <span className="tax-workflow-number">{step.number}</span>
              </Link>
              {index < workflow.length - 1 ? <span className="tax-workflow-arrow" aria-hidden="true">›</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="tax-dashboard-grid">
        <article className="tax-dashboard-card">
          <header>
            <span className="tax-card-icon" aria-hidden="true">≋</span>
            <div>
              <h3>Productive Core</h3>
              <p>A durable foundation for every return.</p>
            </div>
          </header>
          <ul className="tax-capability-list">
            {productiveCore.map((item) => (
              <li key={item}><span aria-hidden="true">▣</span>{item}</li>
            ))}
          </ul>
        </article>

        <article className="tax-dashboard-card">
          <header>
            <span className="tax-card-icon" aria-hidden="true">⚙</span>
            <div>
              <h3>Depth Source Engines</h3>
              <p>Reliable data. Greater coverage.</p>
            </div>
          </header>
          <div className="tax-source-engine-list">
            {sourceEngines.map(([name, description]) => (
              <Link to="/tax/documents/depth" key={name}>
                <span className="tax-source-glyph" aria-hidden="true">◇</span>
                <span><strong>{name}</strong><small>{description}</small></span>
              </Link>
            ))}
          </div>
        </article>

        <article className="tax-dashboard-card">
          <header>
            <span className="tax-card-icon" aria-hidden="true">▤</span>
            <div>
              <h3>2025 Individual Return Core</h3>
              <p>Core forms. Governed calculations.</p>
            </div>
          </header>
          <ul className="tax-check-list">
            {individualCore.map((item) => (
              <li key={item}><span className="tax-check" aria-hidden="true">✓</span>{item}</li>
            ))}
          </ul>
        </article>

        <article className="tax-dashboard-card tax-dashboard-card-next">
          <header>
            <span className="tax-card-icon" aria-hidden="true">»</span>
            <div>
              <h3>Next Engines</h3>
              <p>On deck. Building what comes next.</p>
            </div>
          </header>
          <ul className="tax-next-list">
            {nextEngines.map((item) => (
              <li key={item}><span aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </article>

        <aside className="tax-dashboard-health">
          <article className="tax-health-card">
            <header>
              <span className="tax-card-icon" aria-hidden="true">⌁</span>
              <div>
                <h3>Governance State</h3>
                <p>Live capability boundaries.</p>
              </div>
            </header>
            <ul>
              <li><span className="tax-health-ok" aria-hidden="true">✓</span>Identity required</li>
              <li><span className="tax-health-ok" aria-hidden="true">✓</span>Persistent Tax Fact Ledger</li>
              <li><span className="tax-health-ok" aria-hidden="true">✓</span>Review gates enforced</li>
              <li><span className="tax-health-gated" aria-hidden="true">•</span>E-file provider gated</li>
            </ul>
          </article>

          <article className="tax-governance-card">
            <span className="tax-governance-lock" aria-hidden="true">▣</span>
            <p><strong>Fail-closed governance:</strong> draft-year mappings remain review-gated until official rule packs are approved.</p>
          </article>
        </aside>
      </section>

      <section className="tax-dashboard-trust">
        <span className="tax-trust-shield" aria-hidden="true">◇</span>
        <div>
          <strong>TRUST THROUGH A COMPLETE RECORD</strong>
          <p>From source to signature. Built for accuracy, transparency, and what comes next.</p>
        </div>
        <div className="tax-trust-wave" aria-hidden="true" />
        <span className="tax-trust-tagline">RETURNS TODAY.<br />DEFENSE TOMORROW.</span>
      </section>
    </div>
  );
}
