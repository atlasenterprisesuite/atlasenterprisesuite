import { useEffect, useState } from 'react';
import { listWorkConnections, type WorkConnectionSummary } from './api';
import { WorkSubnav } from './WorkSubnav';

export function WorkConnectionsPage() {
  const [connections, setConnections] = useState<WorkConnectionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listWorkConnections()
      .then((rows) => { if (active) setConnections(rows); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_connections_unavailable'); });
    return () => { active = false; };
  }, []);

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Connections</h1><p>Authorized provider, browser-session and vault references available to the active organization.</p></header>
      <WorkSubnav />
      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {connections === null && !error ? <p aria-busy="true">Loading connections…</p> : null}
      {connections?.length === 0 ? <div className="empty-state"><strong>No authorized Work connections are registered for this organization.</strong><span>Authorize a provider through its approved connection subsystem before Work can use it.</span></div> : null}
      {connections?.length ? <div className="work-card-grid">{connections.map((connection) => (
        <article className="execution-panel" key={connection.id}>
          <p className="eyebrow">{connection.mechanism}</p>
          <h2>{connection.provider}</h2>
          <p>Status: <strong>{connection.status}</strong></p>
          <h3>Capabilities</h3>
          {connection.capabilities.length ? <ul>{connection.capabilities.map((capability) => <li key={capability}><code>{capability}</code></li>)}</ul> : <p>No capabilities are registered.</p>}
        </article>
      ))}</div> : null}
    </section>
  );
}
