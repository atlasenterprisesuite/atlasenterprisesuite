import { useEffect, useState } from 'react';
import { listWorkRuntimes, type WorkRuntimeSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

function labelKind(kind: WorkRuntimeSummary['kind']) {
  return kind.replaceAll('_', ' ');
}

export function WorkRuntimesPage() {
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listWorkRuntimes()
      .then((rows) => { if (active) setRuntimes(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable'); });
    return () => { active = false; };
  }, []);

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Runtimes</h1><p>Authorized Local, Self-Hosted and Cloud Ephemeral execution workers. No runtime is shown as online without a current heartbeat.</p></header>
      <WorkSubnav />
      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {runtimes === null && !error ? <p aria-busy="true">Loading runtimes…</p> : null}
      {runtimes?.length === 0 ? <div className="empty-state"><strong>No Work runtimes are registered for this organization.</strong><span>Enroll an authorized runtime before browser execution can be dispatched.</span></div> : null}
      {runtimes?.length ? <div className="work-card-grid">{runtimes.map((runtime) => (
        <article className="execution-panel" key={runtime.id}>
          <p className="eyebrow">{labelKind(runtime.kind)}</p>
          <h2>{runtime.label}</h2>
          <p>Status: <strong>{runtime.status}</strong></p>
          <p>Last heartbeat: <strong>{runtime.lastSeenAt || 'Never'}</strong></p>
          <h3>Capabilities</h3>
          {runtime.capabilities.length ? <ul>{runtime.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
        </article>
      ))}</div> : null}
    </section>
  );
}
