import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWorkflows } from './api';
import type { WorkWorkflow } from './types';
import { workflowsByView } from './view-model';
import { WorkQueue } from './WorkQueue';
import { WorkSubnav } from './WorkSubnav';

export function WorkCommandCenter() {
  const [workflows, setWorkflows] = useState<WorkWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listWorkflows();
        if (!cancelled) setWorkflows(result);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'work_list_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const active = useMemo(() => workflowsByView(workflows, 'active'), [workflows]);
  const approvals = useMemo(() => workflowsByView(workflows, 'approvals'), [workflows]);
  const recentHistory = useMemo(() => workflowsByView(workflows, 'history').slice(0, 3), [workflows]);

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header work-hero">
        <div>
          <p className="eyebrow">ATLAS Work Soberano</p>
          <h1>Work Command Center</h1>
          <p>Turn intent into canonical, permission-bound, auditable execution.</p>
        </div>
        <Link className="execution-action work-primary-link" to="/work/new">Create work</Link>
      </header>

      <div className="work-summary-grid" aria-label="Work summary">
        <Link to="/work/active" className="work-summary-card"><span>Active</span><strong>{active.length}</strong></Link>
        <Link to="/work/approvals" className="work-summary-card"><span>Awaiting approval</span><strong>{approvals.length}</strong></Link>
        <Link to="/work/history" className="work-summary-card"><span>Recent history</span><strong>{recentHistory.length}</strong></Link>
      </div>

      {loading ? <p role="status">Loading Work workflows…</p> : null}
      {error ? <p role="alert" className="work-error">Work workflows unavailable: {error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="execution-panel">
            <div className="work-section-heading"><h2>Active work</h2><Link to="/work/active">View all</Link></div>
            <WorkQueue workflows={active.slice(0, 6)} emptyMessage="No active Work workflows." />
          </section>
          <section className="execution-panel">
            <div className="work-section-heading"><h2>Recent completed work</h2><Link to="/work/history">View history</Link></div>
            <WorkQueue workflows={recentHistory} emptyMessage="No completed Work workflows yet." />
          </section>
        </>
      ) : null}
    </section>
  );
}
