import { Link } from 'react-router-dom';
import type { WorkWorkflow } from './types';

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WorkQueue({
  workflows,
  emptyMessage = 'No workflows in this view.'
}: {
  workflows: readonly WorkWorkflow[];
  emptyMessage?: string;
}) {
  if (workflows.length === 0) return <p className="work-empty">{emptyMessage}</p>;

  return (
    <div className="work-queue" role="list">
      {workflows.map((workflow) => (
        <Link
          key={workflow.id}
          role="listitem"
          className="work-card"
          to={`/execution/${encodeURIComponent(workflow.id)}`}
        >
          <div className="work-card-heading">
            <strong>{workflow.ownerModule || 'ATLAS Work'}</strong>
            <span className={`work-status work-status-${workflow.status}`}>{statusLabel(workflow.status)}</span>
          </div>
          <p>Current module: {workflow.currentModule || workflow.ownerModule || 'Unassigned'}</p>
          <small>{workflow.updatedAt ? `Updated ${workflow.updatedAt}` : 'No update timestamp available'}</small>
        </Link>
      ))}
    </div>
  );
}
