import { Navigate, Route, Routes } from 'react-router-dom';

function DiseaseReconstructionHome() {
  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Health Frontiers</p>
        <h1>Disease Reconstruction Lab</h1>
        <p>Research workspace for mapping disease reconstruction mechanisms, evidence strength, contradictions, escape routes, repair requirements, and surveillance concepts.</p>
      </header>
      <div className="notice strong" role="status">
        Research-only. No patient diagnosis, treatment recommendation, dosing guidance, or unsupported cure claim is produced here.
      </div>
      <section className="workspace-card">
        <div className="empty-state">
          <strong>No governed research dataset has been restored yet</strong>
          <span>Research records will appear only when provenance, evidence state, and falsification metadata are available.</span>
        </div>
      </section>
    </section>
  );
}

export function DiseaseReconstructionRoutes() {
  return (
    <Routes>
      <Route index element={<DiseaseReconstructionHome />} />
      <Route path="*" element={<Navigate to="/health/research/frontiers/disease-reconstruction" replace />} />
    </Routes>
  );
}
