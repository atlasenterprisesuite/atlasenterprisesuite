import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { runtimeIsHealthy } from '../../../../packages/execution/src/work-runtime';
import {
  listWorkConnections,
  listWorkRuntimes,
  listWorkflows,
  type WorkConnectionSummary,
  type WorkRuntimeSummary
} from './api';
import type { WorkWorkflow } from './types';
import { workflowsByView } from './view-model';
import { WorkQueue } from './WorkQueue';
import { WorkSubnav } from './WorkSubnav';

const ATTENTION_STATUSES = new Set<WorkWorkflow['status']>(['blocked', 'awaiting_approval', 'failed']);

export function WorkCommandCenter() {
  const [workflows, setWorkflows] = useState<WorkWorkflow[]>([]);
  const [connections, setConnections] = useState<WorkConnectionSummary[] | null>(null);
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [resourceWarnings, setResourceWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [workflowResult, connectionResult, runtimeResult] = await Promise.allSettled([
        listWorkflows(),
        listWorkConnections(),
        listWorkRuntimes()
      ]);

      if (cancelled) return;

      if (workflowResult.status === 'fulfilled') {
        setWorkflows(workflowResult.value);
      } else {
        setError(workflowResult.reason instanceof Error ? workflowResult.reason.message : 'work_list_failed');
      }

      const warnings: string[] = [];
      if (connectionResult.status === 'fulfilled') {
        setConnections(connectionResult.value);
      } else {
        warnings.push(connectionResult.reason instanceof Error ? connectionResult.reason.message : 'work_connections_unavailable');
      }

      if (runtimeResult.status === 'fulfilled') {
        setRuntimes(runtimeResult.value);
      } else {
        warnings.push(runtimeResult.reason instanceof Error ? runtimeResult.reason.message : 'work_runtimes_unavailable');
      }

      setResourceWarnings(warnings);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const active = useMemo(() => workflowsByView(workflows, 'active'), [workflows]);
  const approvals = useMemo(() => workflowsByView(workflows, 'approvals'), [workflows]);
  const history = useMemo(() => workflowsByView(workflows, 'history'), [workflows]);
  const recentHistory = useMemo(() => history.slice(0, 3), [history]);
  const blocked = useMemo(() => workflows.filter((workflow) => workflow.status === 'blocked'), [workflows]);
  const failed = useMemo(() => workflows.filter((workflow) => workflow.status === 'failed'), [workflows]);
  const draft = useMemo(() => workflows.filter((workflow) => workflow.status === 'draft'), [workflows]);
  const attention = useMemo(
    () => workflows.filter((workflow) => ATTENTION_STATUSES.has(workflow.status)).slice(0, 6),
    [workflows]
  );

  const activeConnections = useMemo(
    () => connections?.filter((connection) => connection.status === 'active') ?? null,
    [connections]
  );
  const healthyRuntimes = useMemo(
    () => runtimes?.filter((runtime) => runtime.status === 'online' && runtimeIsHealthy(runtime)) ?? null,
    [runtimes]
  );
  const healthyBrowserRuntimes = useMemo(
    () => healthyRuntimes?.filter((runtime) => runtime.capabilities.includes('browser')) ?? null,
    [healthyRuntimes]
  );
  const staleRuntimes = useMemo(
    () => runtimes?.filter((runtime) => runtime.status === 'online' && !runtimeIsHealthy(runtime)) ?? null,
    [runtimes]
  );

  return (
    <section className="work-page page-stack">
      <WorkSubnav />

      <header className="page-header work-hero work-command-hero">
        <div>
          <p className="eyebrow">ATLAS Work Soberano</p>
          <h1>Work Command Center</h1>
          <p>One operational surface for intent, approvals, blockers, execution resources, evidence and resumable work.</p>
        </div>
        <div className="work-hero-actions">
          <Link className="execution-action work-primary-link" to="/work/new">Create work</Link>
          <Link className="work-os-secondary-link" to="/work/os">Open Work OS</Link>
        </div>
      </header>

      <div className="work-summary-grid" aria-label="Work summary">
        <Link to="/work/active" className="work-summary-card"><span>Active</span><strong>{active.length}</strong></Link>
        <Link to="/work/approvals" className="work-summary-card"><span>Awaiting approval</span><strong>{approvals.length}</strong></Link>
        <Link to="/work/active" className="work-summary-card"><span>Blocked</span><strong>{blocked.length}</strong></Link>
        <Link to="/work/history" className="work-summary-card"><span>History</span><strong>{history.length}</strong></Link>
      </div>

      {loading ? <p role="status">Loading Work command state…</p> : null}
      {error ? <p role="alert" className="work-error">Work workflows unavailable: {error}</p> : null}
      {resourceWarnings.length ? (
        <p role="status" className="notice work-command-warning">
          Live capability snapshot incomplete: {resourceWarnings.join(', ')}. Workflow state remains available independently.
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="work-command-grid">
            <section className="execution-panel work-command-panel" aria-labelledby="work-execution-pulse">
              <div className="work-section-heading">
                <div>
                  <p className="eyebrow">Execution pulse</p>
                  <h2 id="work-execution-pulse">Canonical workflow state</h2>
                </div>
                <Link to="/work/active">Open queue</Link>
              </div>

              <div className="work-command-rows">
                <Link to="/work/active" className="work-command-row"><span>Active workflows</span><strong>{active.length}</strong></Link>
                <Link to="/work/approvals" className="work-command-row"><span>Approval gate</span><strong>{approvals.length}</strong></Link>
                <Link to="/work/active" className="work-command-row"><span>Blocked workflows</span><strong>{blocked.length}</strong></Link>
                <Link to="/work/history" className="work-command-row"><span>Failed / retryable</span><strong>{failed.length}</strong></Link>
                <Link to="/work/active" className="work-command-row"><span>Draft plans</span><strong>{draft.length}</strong></Link>
              </div>
            </section>

            <section className="execution-panel work-command-panel" aria-labelledby="work-control-plane">
              <div className="work-section-heading">
                <div>
                  <p className="eyebrow">Execution resources</p>
                  <h2 id="work-control-plane">Control plane</h2>
                </div>
                <Link to="/work/policies">Policies</Link>
              </div>

              <div className="work-command-rows">
                <Link to="/work/connections" className="work-command-row">
                  <span>Provider connections</span>
                  <strong>{activeConnections === null || connections === null ? 'Unavailable' : activeConnections.length + ' active of ' + connections.length}</strong>
                </Link>
                <Link to="/work/runtimes" className="work-command-row">
                  <span>Healthy runtimes</span>
                  <strong>{healthyRuntimes === null || runtimes === null ? 'Unavailable' : healthyRuntimes.length + ' healthy of ' + runtimes.length}</strong>
                </Link>
                <Link to="/work/runtimes" className="work-command-row">
                  <span>Browser dispatch</span>
                  <strong>{healthyBrowserRuntimes === null ? 'Unavailable' : healthyBrowserRuntimes.length + ' verified'}</strong>
                </Link>
                <Link to="/work/runtimes" className="work-command-row">
                  <span>Stale heartbeats</span>
                  <strong>{staleRuntimes === null ? 'Unavailable' : staleRuntimes.length}</strong>
                </Link>
                <Link to="/work/computer-operations" className="work-command-row">
                  <span>Computer operations</span>
                  <strong>Inspect</strong>
                </Link>
              </div>
            </section>
          </div>

          <section className="execution-panel">
            <div className="work-section-heading">
              <div>
                <p className="eyebrow">Priority</p>
                <h2>Needs attention</h2>
              </div>
              <Link to="/work/active">View active</Link>
            </div>
            <WorkQueue
              workflows={attention}
              emptyMessage="No blocked, approval-gated, or failed workflows require attention."
            />
          </section>

          <section className="execution-panel">
            <div className="work-section-heading"><h2>Active work</h2><Link to="/work/active">View all</Link></div>
            <WorkQueue workflows={active.slice(0, 6)} emptyMessage="No active Work workflows." />
          </section>

          <section className="execution-panel">
            <div className="work-section-heading"><h2>Recent history</h2><Link to="/work/history">View history</Link></div>
            <WorkQueue workflows={recentHistory} emptyMessage="No Work workflow history yet." />
          </section>
        </>
      ) : null}
    </section>
  );
}
