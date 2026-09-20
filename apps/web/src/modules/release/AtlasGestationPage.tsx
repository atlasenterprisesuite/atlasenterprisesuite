import { Link } from 'react-router-dom';
import { ATLAS_MODULES } from '../registry';
import { ATLAS_GESTATION_PHASES, summarizeGestation } from './gestation';

const statusLabel = {
  complete: 'Gate passed',
  'in-progress': 'In gestation',
  blocked: 'Blocked by prior gate'
} as const;

export function AtlasGestationPage() {
  const summary = summarizeGestation(ATLAS_MODULES);

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Release Control · Gestation A-Z</p>
        <h1>From conception to birth</h1>
        <p>
          ATLAS is complete only when its interior governance, organs, connections, intelligence,
          product experience and external boundaries pass their gates as one production organism.
        </p>
      </header>

      <div className="notice strong">
        Current gestational gate: <strong>{summary.currentPhase.biologicalAnalogy}</strong> · {summary.currentPhase.atlasLayer}.
        Later work may already exist, but birth stays fail-closed until every earlier gate passes.
      </div>

      <div className="stat-grid" aria-label="ATLAS gestation evidence">
        <article><strong>{summary.completedPhases}/{summary.totalPhases}</strong><span>sequential gates passed</span></article>
        <article><strong>{summary.moduleCounts.implemented}</strong><span>modules marked implemented</span></article>
        <article><strong>{summary.moduleCounts.partial}</strong><span>modules marked partial</span></article>
        <article><strong>{summary.moduleCounts['external-gated']}</strong><span>modules externally gated</span></article>
      </div>

      <div className="module-grid">
        {ATLAS_GESTATION_PHASES.map((phase) => (
          <article className={`module-card ${phase.status === 'complete' ? 'enabled' : 'disabled'}`} key={phase.id}>
            <span>Phase {phase.order} · {statusLabel[phase.status]}</span>
            <strong>{phase.biologicalAnalogy}</strong>
            <p>{phase.atlasLayer}</p>
            <small>{phase.exitGate}</small>
            <details>
              <summary>Evidence boundary</summary>
              <ul>{phase.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
          </article>
        ))}
      </div>

      <div className="notice">
        No percentage is inferred from code volume. A phase changes to complete only when its exit gate has evidence.
        External integrations never count as live merely because a UI or adapter exists.
      </div>

      <div className="action-row">
        <Link className="action-link" to="/suite">Inspect A-Z modules</Link>
        <Link className="action-link" to="/execution/manager/readiness">Open execution readiness</Link>
        <Link className="action-link" to="/galaxy">Open system map</Link>
        <Link className="action-link" to="/release">Return to Release Control</Link>
      </div>
    </section>
  );
}
