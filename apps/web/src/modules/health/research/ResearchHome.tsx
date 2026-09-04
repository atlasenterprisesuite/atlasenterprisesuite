import { Link } from 'react-router-dom';

export function ResearchHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Research</p>
        <h1>Research & Innovation</h1>
        <p>Governed biomedical research workspace for evidence, contradictions, reconstruction hypotheses, and uncertainty tracking.</p>
      </header>
      <div className="notice" role="status">
        Research workspace only. It does not provide diagnosis, treatment recommendations, medication dosing, or patient-specific clinical decision support.
      </div>
      <div className="module-grid">
        <Link className="module-card enabled" to="/health/research/frontiers">
          <span>Research workspace</span>
          <strong>Health Frontiers</strong>
          <p>Open the governed research surface and Disease Reconstruction Lab.</p>
        </Link>
      </div>
    </section>
  );
}
