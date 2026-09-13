import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { probeOrchestrator, type OrchestratorProbeResult } from './orchestratorClient';
import './orchestrator.css';

const areas = [
  { title: 'Execution Engine', body: 'Workflows, tasks, blockers, approvals and governed execution evidence.', action: '/execution/system-readiness' },
  { title: 'Self-Healing Operations', body: 'Incident intake, diagnosis, safe remediation planning, verification and resolution evidence.' },
  { title: 'AI Council', body: 'Provider-neutral collaboration behind ATLAS policy and intelligence routing. Connection state is shown only when verified.' },
  { title: 'System Health', body: 'Fail-closed health and readiness from the existing ATLAS Orchestrator runtime.' }
];

export function OrchestratorPage() {
  const [probe, setProbe] = useState<OrchestratorProbeResult>({ state: 'unknown', detail: 'Checking runtime readiness…' });

  useEffect(() => {
    const controller = new AbortController();
    probeOrchestrator(controller.signal).then(setProbe).catch((error) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setProbe({ state: 'unavailable', detail: 'Readiness probe failed.' });
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="page-stack orchestrator-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Sovereign Intelligence</p>
        <h1>ATLAS Orchestrator</h1>
        <p>One governed command surface for execution, AI collaboration, self-healing operations and runtime readiness.</p>
      </header>

      <div className={`orchestrator-status state-${probe.state}`} role="status">
        <div><span className="eyebrow">Runtime</span><strong>{probe.state}</strong></div>
        <p>{probe.detail || 'Runtime state verified by ATLAS readiness probes.'}</p>
      </div>

      <div className="orchestrator-grid">
        {areas.map((area) => (
          <article className="orchestrator-card" key={area.title}>
            <h2>{area.title}</h2>
            <p>{area.body}</p>
            {area.action ? <Link className="action-link" to={area.action}>Open governed execution</Link> : <span className="orchestrator-boundary">Governed boundary active</span>}
          </article>
        ))}
      </div>

      <div className="notice">
        No AI agent is root. Destructive, financial, permission-changing, audit/security-boundary and irreversible actions require governed approval.
      </div>
    </section>
  );
}
