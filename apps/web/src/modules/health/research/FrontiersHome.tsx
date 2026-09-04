import { Link } from 'react-router-dom';

export function FrontiersHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Research & Innovation</p>
        <h1>Health Frontiers</h1>
        <p>Evidence-governed exploration of persistent disease mechanisms, contradictions, vulnerabilities, relapse paths, repair needs, and surveillance concepts.</p>
      </header>
      <div className="notice strong">
        Evidence state matters: hypotheses remain hypotheses, contradictory evidence stays visible, and cure claims require reproducible human evidence.
      </div>
      <div className="module-grid">
        <Link className="module-card enabled" to="/health/research/frontiers/disease-reconstruction">
          <span>Health Frontiers</span>
          <strong>Disease Reconstruction Lab</strong>
          <p>Enter the research-only reconstruction workspace.</p>
        </Link>
      </div>
    </section>
  );
}
