import { Link, useLocation } from 'react-router-dom';
import {
  ANALYTICS_SOURCES,
  METRIC_CATALOG,
  analyticsReadinessSummary,
  evaluateMetricReadiness,
  sourceById
} from '../../../../../packages/analytics/src/index';
import './analytics.css';

const NAV = [
  { to: '/analytics', label: 'Overview' },
  { to: '/analytics/metrics', label: 'Metrics' },
  { to: '/analytics/sources', label: 'Sources' },
  { to: '/analytics/insights', label: 'Insights' },
  { to: '/analytics/forecasting', label: 'Forecasting' },
  { to: '/analytics/governance', label: 'Governance' }
] as const;

function StateBadge({ state }: { state: string }) {
  return <span className={`analytics-state analytics-state-${state}`}>{state.replaceAll('-', ' ')}</span>;
}

function SourceCards() {
  return (
    <div className="analytics-grid">
      {ANALYTICS_SOURCES.map((source) => (
        <article className="analytics-card" key={source.id}>
          <div className="analytics-card-topline">
            <span>{source.domain}</span>
            <StateBadge state={source.state} />
          </div>
          <h3>{source.name}</h3>
          <p>{source.evidence}</p>
          <Link to={source.route}>Open source module →</Link>
        </article>
      ))}
    </div>
  );
}

function MetricCards() {
  return (
    <div className="analytics-grid analytics-grid-metrics">
      {METRIC_CATALOG.map((metric) => {
        const readiness = evaluateMetricReadiness(metric);
        return (
          <article className="analytics-card" key={metric.id}>
            <div className="analytics-card-topline">
              <span>{metric.category}</span>
              <StateBadge state={readiness.ready ? 'verified' : 'contract-gated'} />
            </div>
            <h3>{metric.name}</h3>
            <p>{metric.description}</p>
            <dl className="analytics-definition">
              <div><dt>Unit</dt><dd>{metric.unit}</dd></div>
              <div><dt>Required sources</dt><dd>{metric.requiredSources.map((id) => sourceById(id)?.name ?? id).join(', ')}</dd></div>
            </dl>
            {!readiness.ready ? (
              <small>Blocked by: {readiness.blockedSourceIds.join(', ') || readiness.missingSourceIds.join(', ')}</small>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Overview() {
  const summary = analyticsReadinessSummary();
  const lifecycle = [
    ['01', 'Source', 'Identify the owning ATLAS system and organization scope.'],
    ['02', 'Contract', 'Define grain, dimensions, period, unit and business meaning.'],
    ['03', 'Lineage', 'Preserve source record lineage and transformation evidence.'],
    ['04', 'Quality', 'Check completeness, freshness, duplicates and reconciliation.'],
    ['05', 'Metric', 'Compute only when all required source gates pass.'],
    ['06', 'Explain', 'Expose drivers, variance and provenance without hidden totals.'],
    ['07', 'Forecast', 'Separate predictions from observed historical facts.'],
    ['08', 'Act', 'Route decisions back to the owning module with permission checks.']
  ] as const;

  return (
    <>
      <section className="analytics-summary-grid" aria-label="Analytics readiness summary">
        <article><span>Sources</span><strong>{summary.totalSources}</strong><small>registered contracts</small></article>
        <article><span>Verified live</span><strong>{summary.verifiedSources}</strong><small>production-eligible now</small></article>
        <article><span>Demo</span><strong>{summary.demoSources}</strong><small>clearly isolated</small></article>
        <article><span>Gated</span><strong>{summary.gatedSources}</strong><small>waiting on evidence</small></article>
        <article><span>Live KPIs</span><strong>{summary.productionMetricCount}</strong><small>never fabricated</small></article>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-heading">
          <p className="eyebrow">Genesis → Revelation</p>
          <h2>Analytics lifecycle</h2>
          <p>Every number must travel from an authoritative source to a governed decision with traceable evidence.</p>
        </div>
        <div className="analytics-lifecycle">
          {lifecycle.map(([index, title, description]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-section">
        <div className="analytics-section-heading">
          <p className="eyebrow">Executive intelligence</p>
          <h2>What this module is designed to answer</h2>
        </div>
        <div className="analytics-grid">
          <article className="analytics-card"><h3>What happened?</h3><p>Observed, reconciled historical performance by period, entity, product, customer and team.</p></article>
          <article className="analytics-card"><h3>Why did it happen?</h3><p>Variance, contribution, segment and driver analysis with direct lineage to source systems.</p></article>
          <article className="analytics-card"><h3>What is likely next?</h3><p>Forecasts with explicit model assumptions, confidence and separation from actuals.</p></article>
          <article className="analytics-card"><h3>What should happen next?</h3><p>Governed handoff to the owning ATLAS module; Analytics never bypasses approval or permission boundaries.</p></article>
        </div>
      </section>
    </>
  );
}

function Insights() {
  return (
    <section className="analytics-section">
      <div className="analytics-section-heading">
        <p className="eyebrow">Explainable intelligence</p>
        <h2>Insights workbench</h2>
        <p>Insight generation remains inactive until at least one production metric has verified source lineage.</p>
      </div>
      <div className="analytics-empty">
        <strong>No production insights available yet.</strong>
        <p>This is an intentional fail-closed state, not an error. Connect and verify authoritative sources first.</p>
        <Link to="/analytics/sources">Review source gates</Link>
      </div>
    </section>
  );
}

function Forecasting() {
  return (
    <section className="analytics-section">
      <div className="analytics-section-heading">
        <p className="eyebrow">Predictive layer</p>
        <h2>Forecasting & scenarios</h2>
        <p>Forecasts require verified historical observations, documented assumptions and measurable backtesting.</p>
      </div>
      <div className="analytics-grid">
        <article className="analytics-card"><h3>Baseline forecast</h3><p>Projects forward from verified historical series. Disabled until sufficient history exists.</p><StateBadge state="contract-gated" /></article>
        <article className="analytics-card"><h3>Scenario planning</h3><p>Compares explicit assumptions without rewriting historical actuals.</p><StateBadge state="contract-gated" /></article>
        <article className="analytics-card"><h3>Forecast accuracy</h3><p>Tracks error against realized outcomes so models can be challenged and improved.</p><StateBadge state="contract-gated" /></article>
      </div>
    </section>
  );
}

function Governance() {
  const controls = [
    'Organization and tenant isolation before any query or aggregation',
    'Least-privilege analytics.read / analytics.manage permission model',
    'Metric definition versioning and stable business semantics',
    'Source lineage from metric result to owning module and record family',
    'Freshness and data-quality checks before publishing a KPI',
    'Observed actuals kept separate from forecasts and scenarios',
    'No connected, approved, paid or completed state without evidence',
    'Exports inherit source authorization and must not widen data access',
    'Cross-module actions route through the owning module and approval gates',
    'Audit evidence for governed configuration and consequential changes'
  ];
  return (
    <section className="analytics-section">
      <div className="analytics-section-heading">
        <p className="eyebrow">Zero-trust analytics</p>
        <h2>Governance contract</h2>
      </div>
      <ol className="analytics-control-list">
        {controls.map((control) => <li key={control}>{control}</li>)}
      </ol>
    </section>
  );
}

export function AnalyticsRoutes() {
  const { pathname } = useLocation();
  const tab = pathname === '/analytics' ? 'overview' : pathname.split('/')[2] || 'overview';

  return (
    <main className="analytics-shell">
      <header className="analytics-hero">
        <div>
          <p className="eyebrow">ATLAS Enterprise Suite · Business intelligence</p>
          <h1>ATLAS Business Analytics</h1>
          <p className="analytics-lead">
            From source truth to decision: governed metrics, lineage, quality, insight, forecasting and action across the ATLAS ecosystem.
          </p>
          <p className="analytics-mantra">Observe • Reconcile • Explain • Forecast • Decide • Act • Verify</p>
        </div>
        <div className="analytics-orbit" aria-hidden="true"><span>A</span></div>
      </header>

      <nav className="analytics-nav" aria-label="Business Analytics">
        {NAV.map((item) => (
          <Link className={pathname === item.to || (item.to !== '/analytics' && pathname.startsWith(item.to)) ? 'active' : ''} to={item.to} key={item.to}>
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? <Overview /> : null}
      {tab === 'metrics' ? <section className="analytics-section"><div className="analytics-section-heading"><p className="eyebrow">Semantic layer</p><h2>Metric catalog</h2><p>Definitions are visible before values. A metric stays gated until every required source contract passes.</p></div><MetricCards /></section> : null}
      {tab === 'sources' ? <section className="analytics-section"><div className="analytics-section-heading"><p className="eyebrow">Source registry</p><h2>Data sources & lineage gates</h2><p>These are capability contracts, not claims that a live provider session currently exists.</p></div><SourceCards /></section> : null}
      {tab === 'insights' ? <Insights /> : null}
      {tab === 'forecasting' ? <Forecasting /> : null}
      {tab === 'governance' ? <Governance /> : null}

      <footer className="analytics-truth">
        Cross-module totals remain unavailable until authoritative source contracts, tenant scope, lineage and quality checks are verified. ATLAS will show an empty or gated state instead of fabricating business performance.
      </footer>
    </main>
  );
}
