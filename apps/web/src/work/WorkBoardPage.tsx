import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWorkflows } from './api';
import { WorkSubnav } from './WorkSubnav';
import { buildWorkBoard } from './work-board-model';
import type { WorkWorkflow } from './types';

function labelStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

/**
 * Jira-style planning view over the canonical ATLAS Work API.
 * Navigation is live; state transitions deliberately stay with governed
 * ATLAS Execution and its approvals, permissions and audit trail.
 */
export function WorkBoardPage() {
  const [workflows, setWorkflows] = useState<WorkWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await listWorkflows();
        if (!cancelled) setWorkflows(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'work_board_unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const modules = useMemo(
    () => [...new Set(workflows.map(workflow => workflow.ownerModule).filter(Boolean))].sort(),
    [workflows]
  );

  const projected = useMemo(() => {
    try {
      return { columns: buildWorkBoard(workflows, { query, module }), error: null };
    } catch (caught) {
      return {
        columns: null,
        error: caught instanceof Error ? caught.message : 'work_board_invalid_data'
      };
    }
  }, [workflows, query, module]);

  const visibleCount = projected.columns?.reduce((count, lane) => count + lane.workflows.length, 0) ?? 0;

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work · Collaborative planning</p>
        <h1>Work Board</h1>
        <p>Explore real organization-scoped workflows across their canonical execution states. No demo cards or duplicate task store.</p>
      </header>

      <div className="work-actions">
        <Link className="execution-action work-primary-link" to="/work/new">Create governed work</Link>
        <button type="button" className="work-os-secondary-link" onClick={() => setRefresh(value => value + 1)} disabled={loading}>
          Refresh board
        </button>
      </div>

      {loading ? <p role="status">Loading authorized Work workflows…</p> : null}
      {error ? <p role="alert" className="work-error">Work board unavailable: {error}</p> : null}
      {!loading && !error && projected.error ? (
        <p role="alert" className="work-error">Work board data rejected: {projected.error}</p>
      ) : null}

      {!loading && !error && projected.columns ? (
        <>
          <div className="work-board-controls">
            <label>
              Search workflows
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Workflow, module or status"
              />
            </label>
            <label>
              Owner module
              <select value={module} onChange={event => setModule(event.target.value)}>
                <option value="">All modules</option>
                {modules.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <p role="status" aria-live="polite">
            {visibleCount} of {workflows.length} authorized workflows shown.
            State changes require governed execution and approval.
          </p>
          <div className="work-board" aria-label="Workflows by canonical execution state">
            {projected.columns.map(lane => (
              <section className="work-board-lane" key={lane.id} aria-labelledby={`work-board-${lane.id}`}>
                <div className="work-board-heading">
                  <h2 id={`work-board-${lane.id}`}>{lane.title}</h2>
                  <span aria-label={`${lane.workflows.length} workflows`}>{lane.workflows.length}</span>
                </div>
                {lane.workflows.length === 0 ? (
                  <p className="work-board-empty">No matching workflows</p>
                ) : (
                  <div role="list" className="work-board-cards">
                    {lane.workflows.map(workflow => (
                      <Link
                        role="listitem"
                        className="work-card"
                        key={workflow.id}
                        to={`/execution/${encodeURIComponent(workflow.id)}`}
                        aria-label={`Open ${workflow.ownerModule || 'ATLAS Work'} workflow ${workflow.id}, ${labelStatus(workflow.status)}`}
                      >
                        <div className="work-card-heading">
                          <strong>{workflow.ownerModule || 'ATLAS Work'}</strong>
                          <span className={`work-status work-status-${workflow.status}`}>{labelStatus(workflow.status)}</span>
                        </div>
                        <p>Current module: {workflow.currentModule || 'Unassigned'}</p>
                        <small>Workflow {workflow.id}</small>
                        <small>{workflow.updatedAt ? `Updated ${workflow.updatedAt}` : 'No update timestamp available'}</small>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
