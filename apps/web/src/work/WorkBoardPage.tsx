import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listWorkflows } from './api';
import type { WorkWorkflow } from './types';
import { WorkSubnav } from './WorkSubnav';

type Lane = { id: string; title: string; statuses: string[] };

const LANES: Lane[] = [
  { id: 'ready', title: 'Ready / Now', statuses: ['draft', 'ready', 'now', 'running', 'in_progress'] },
  { id: 'attention', title: 'Needs attention', statuses: ['blocked', 'waiting_human', 'waiting_approval', 'approval_required'] },
  { id: 'done', title: 'Completed', statuses: ['completed', 'done', 'closed'] },
  { id: 'stopped', title: 'Stopped', statuses: ['failed', 'cancelled', 'denied'] }
];

function laneFor(status: string) {
  return LANES.find(lane => lane.statuses.includes(status))?.id || 'ready';
}

export function WorkBoardPage() {
  const [workflows, setWorkflows] = useState<WorkWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setError('');
    try { setWorkflows(await listWorkflows()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'work_board_unavailable'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkWorkflow[]>(LANES.map(lane => [lane.id, []]));
    for (const workflow of workflows) map.get(laneFor(String(workflow.status)))?.push(workflow);
    return map;
  }, [workflows]);

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work · Board</p>
        <h1>Collaborative execution board</h1>
        <p>This board is a live projection of canonical ATLAS Work workflows. It does not create a second task database.</p>
        <div className="atlas-action-row">
          <Link className="execution-action" to="/work/new">Create work</Link>
          <button className="execution-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>
      </header>
      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {loading ? <div className="notice" role="status">Loading organization work…</div> : null}
      <div className="work-board" aria-label="ATLAS Work board">
        {LANES.map(lane => {
          const items = grouped.get(lane.id) || [];
          return (
            <section className="execution-panel" key={lane.id} aria-labelledby={'work-board-' + lane.id}>
              <div className="work-section-heading">
                <div><p className="eyebrow">{items.length} workflow{items.length === 1 ? '' : 's'}</p><h2 id={'work-board-' + lane.id}>{lane.title}</h2></div>
              </div>
              <div className="module-grid compact">
                {items.length ? items.map(workflow => (
                  <Link className="module-card enabled" to={'/execution/' + encodeURIComponent(workflow.id)} key={workflow.id}>
                    <span>{workflow.ownerModule || 'work'} · {String(workflow.status)}</span>
                    <strong>{workflow.intent || 'Governed ATLAS Work'}</strong>
                    <p>Runtime: {workflow.work?.runtimePreference || 'auto'} · Autonomy: {workflow.work?.autonomyLevel || 'guided'}</p>
                  </Link>
                )) : <p className="muted">No workflows in this lane.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
